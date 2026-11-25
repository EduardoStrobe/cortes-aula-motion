#!/usr/bin/env python3
"""Head track for the face bubble -> src/data/face-track.json   (py -3.12 scripts/face_track.py [c1 .. c6] [--strip])

Why: spec/data/face.json only tracks the crop centre in x; y is fixed at tile y 146. Whenever the doctor leans
towards the screen his face sits lower in the webcam tile than that crop, and the bubble showed forehead and
glasses only (c1 f 420-1264 and the whole closing lockup, c5 f 75-305, c6 f 35-220, c4 f 916-1055).

Method (numpy + Pillow only, no detector): skin-coloured pixels of public/<id>/cam.mp4 (418x302, 30 fps) minus the
skin-coloured pixels of the static background (orange book spines; taken from a frame of c4 in which he has left
the picture), then a mean-shift window (180 x 220 px) that follows the blob from frame to frame. The crop centre is
x = the blob centroid, y = HEAD_DROP px below the hairline (the top of the blob; a talking head reads best with the
eyes a little above the middle), median-filtered (9 f), smoothed with a zero-phase moving average (21 f) and
clamped to the tile (cx 118..299, cy 118..184 for the crop radius 118). When he leans in the crop therefore
sinks to the bottom of the tile, which is all the footage has (his chin is below the tile edge then).

Output per cut: { "step": 3, "pts": [[cx, cy], ...] (every 3rd frame), "lost": [[a, b], ...] }.
`lost` REPLACES face.json's list (src/aula/data.ts): it is the hand-checked list below (bubble strips looked at
with the new framing), not a detector result.

The burned-in Zoom label "Nome do Apresentador" (tile x 14-134, y 271-293) can now fall inside the crop circle when the
crop goes low; components/FaceBubble.tsx paints it out (see FaceCrop). The label is never shown.

--strip writes out/review/face/<id>-strip.jpg: the bubble crop every 10th frame, old framing above new framing.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 418, 302          # cam.mp4 (tile-local x = proxy x - 1)
R = 118
HEAD_DROP = 60          # crop centre = hairline + 60 px (upright: eyes a little above the middle of the bubble)
LIFT_MAX = 45
STEP = 3
WIN_X, WIN_Y = 90, 110
# face-lost intervals per cut (frames; the camera block shows a still), checked on strips of the CAMERA BLOCK framing
# (tile y 4..266, 262 px wide around cx: out/eng/face/<id>-block.jpg):
#   c2  84-128   he ducks out of the picture and comes back blurred
#       (f 198-226, scratching his head, is NOT lost any more: the block shows his whole head and the hand;
#        f 432-442, another participant's placeholder in the tile, is listed in the c2 storyboard: face.lost)
#   c4  414-488  he leaves the picture and comes back (was 430-476: the live crop showed him sliding out / in)
#   c5  226-284  only the top of his head is in the tile. The old 28-72 ("rubs his head") is NOT lost any more:
#                his face and hands are in the block, and a frozen still in the hook read as a freeze
LOST = {
    "c1": [], "c2": [[84, 128]], "c3": [], "c4": [[414, 488]], "c5": [[226, 284]], "c6": [],
}


def frames(cid):
    path = os.path.join(ROOT, "public", cid, "cam.mp4")
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        buf = p.stdout.read(n)
        if len(buf) < n:
            break
        yield np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 3)
    p.wait()


def skin(img):
    r = img[:, :, 0].astype(np.int16)
    g = img[:, :, 1].astype(np.int16)
    b = img[:, :, 2].astype(np.int16)
    return (r > 95) & (g > 45) & (b > 25) & (r - g > 14) & (r - b > 20) & (g - b > -5) & (r - g < 90)


def dilate(m, k=3):
    out = m.copy()
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            out |= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


def background_skin():
    """skin-coloured pixels of the empty room (c4, he is out of the picture around f 452)."""
    for i, fr in enumerate(frames("c4")):
        if i == 452:
            m = dilate(skin(fr), 3)
            m[:, 230:] = False      # that frame still has his head at the right edge
            m[150:, 150:] = False
            return m
    raise SystemExit("c4/cam.mp4 has no frame 452")


def track(cid, bg):
    ys, xs = np.mgrid[0:H, 0:W]
    cx, cy = 200.0, 170.0
    raw = []
    for fr in frames(cid):
        m = skin(fr) & ~bg
        m[268:, :140] = False                      # the white label never matches, its shadow may
        x, y = cx, cy
        n = 0
        for it in range(4):
            win = m & (np.abs(xs - x) <= WIN_X * (2 if it == 0 and n == 0 else 1)) & (np.abs(ys - y) <= WIN_Y * (2 if it == 0 and n == 0 else 1))
            n = int(win.sum())
            if n < 250:
                break
            x, y = float(xs[win].mean()), float(ys[win].mean())
        if n < 250:
            # lost: fall back to the global blob if there is one, else hold
            tot = int(m.sum())
            if tot >= 600:
                x, y = float(xs[m].mean()), float(ys[m].mean())
                n = tot
            else:
                x, y = cx, cy
        cx, cy = x, y
        win = m & (np.abs(xs - x) <= WIN_X) & (np.abs(ys - y) <= WIN_Y)
        top = float(np.percentile(ys[win], 3)) if int(win.sum()) >= 250 else y - 60
        raw.append((x, y, n, top))
    return np.array(raw)


def smooth(v, med=9, avg=21):
    n = len(v)
    h = med // 2
    pad = np.pad(v, (h, h), mode="edge")
    m = np.array([np.median(pad[i:i + med]) for i in range(n)])
    h = avg // 2
    pad = np.pad(m, (h, h), mode="edge")
    k = np.ones(avg) / avg
    return np.convolve(pad, k, mode="valid")


def crop_circle(img, cx, cy, d=104):
    """the bubble as the engine draws it (radius R around (cx, cy)), d px wide"""
    box = Image.fromarray(img).crop((int(round(cx + 1 - R)), int(round(cy - R)), int(round(cx + 1 + R)), int(round(cy + R))))
    box = box.resize((d, d), Image.BILINEAR)
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, d - 1, d - 1), fill=255)
    out = Image.new("RGB", (d, d), (28, 30, 34))
    out.paste(box, (0, 0), mask)
    return out


def old_cx(face, f):
    k = face["keys"]
    if f <= k[0][0]:
        return k[0][1]
    for i in range(1, len(k)):
        if f <= k[i][0]:
            t = (f - k[i - 1][0]) / (k[i][0] - k[i - 1][0])
            return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * t
    return k[-1][1]


def main():
    args = sys.argv[1:]
    ids = [a for a in args if a.startswith("c")] or ["c1", "c2", "c3", "c4", "c5", "c6"]
    strip = "--strip" in args
    dst = os.path.join(ROOT, "src", "data", "face-track.json")
    out = {}
    if os.path.exists(dst):
        out = {k: v for k, v in json.load(open(dst, encoding="utf-8")).items() if not k.startswith("_")}
    face = json.load(open(os.path.join(ROOT, "src", "data", "face.json"), encoding="utf-8"))
    bg = background_skin()
    for cid in ids:
        raw = track(cid, bg)
        cx = np.clip(smooth(raw[:, 0]), R, W - 1 - R)
        # crop centre y: HEAD_DROP px below the hairline (top of the skin blob), never below the blob centroid
        # (hands on the head pull the "hairline" up) and never above centroid - LIFT_MAX
        want = np.minimum(raw[:, 3] + HEAD_DROP, raw[:, 1])
        want = np.maximum(want, raw[:, 1] - LIFT_MAX)
        cy = np.clip(smooth(want), R, H - R)
        pts = [[int(round(cx[i])), int(round(cy[i]))] for i in range(0, len(cx), STEP)]
        out[cid] = {"step": STEP, "pts": pts, "lost": LOST.get(cid, [])}
        print(f"[{cid}] {len(cx)} frames  cx {cx.min():.0f}..{cx.max():.0f}  cy {cy.min():.0f}..{cy.max():.0f}  "
              f"blob px median {np.median(raw[:, 2]):.0f}, min {raw[:, 2].min():.0f}")
        if strip:
            d = 104
            sel = list(range(0, len(cx), 10))
            cols = 20
            rows = (len(sel) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * d, rows * (2 * d + 18)), (28, 30, 34))
            dr = ImageDraw.Draw(sheet)
            want = set(sel)
            k = 0
            for i, fr in enumerate(frames(cid)):
                if i not in want:
                    continue
                x0, y0 = (k % cols) * d, (k // cols) * (2 * d + 18)
                sheet.paste(crop_circle(fr, old_cx(face[cid], i), 146, d), (x0, y0))
                sheet.paste(crop_circle(fr, cx[i], cy[i], d), (x0, y0 + d))
                dr.text((x0 + 2, y0 + 2 * d + 2), f"{i}", fill=(255, 255, 255))
                k += 1
            os.makedirs(os.path.join(ROOT, "out", "review", "face"), exist_ok=True)
            sp = os.path.join(ROOT, "out", "review", "face", f"{cid}-strip.jpg")
            sheet.save(sp, quality=85)
            print(f"[{cid}] strip -> {sp}")
    doc = ("Head track for the face bubble (tile-local px, crop radius 118): pts[i] = [cx, cy] of frame i * step, linear "
           "interpolation in between. lost = face-lost intervals (replace face.json's). Written by scripts/face_track.py; "
           "do not edit by hand.")
    with open(dst, "w", encoding="utf-8", newline="\n") as f:
        f.write("{\n " + json.dumps("_doc") + ": " + json.dumps(doc) + ",\n")
        f.write(",\n".join(f" {json.dumps(k)}: {json.dumps(v, separators=(',', ':'))}" for k, v in out.items()))
        f.write("\n}\n")
    print(f"written {dst}")


if __name__ == "__main__":
    main()
