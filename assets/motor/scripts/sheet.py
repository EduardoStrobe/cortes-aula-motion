#!/usr/bin/env python3
"""Tile stills into one labelled contact sheet (Pillow).   Run with:  py -3.12 scripts/sheet.py ...

  py -3.12 scripts/sheet.py out/stills/rp-c5 -o out/sheets/rp-c5.png
  py -3.12 scripts/sheet.py out/stills/rp-c1 --frames 0,104,112,890 --cols 4 --width 405
  py -3.12 scripts/sheet.py a.png b.png c.png -o sheet.png --labels "hook,body,closing"

Inputs: a directory (every f*.png / *.png / *.jpg in it, sorted) and/or image files.
  --frames  with a directory: only these frames (f00000.png naming of scripts/stills.mjs); ranges a-b[:step] allowed
  --cols    columns (default 5)        --width  tile width in px (default 360; height follows the image)
  --labels  comma list overriding the labels (default: file stem, with the time in seconds for f<frame> names)
  --safe    draw the unsafe-zone guides (y 220, y 1500, x 960 of the 1080x1920 frame) on every tile
  -o        output file (default: <first dir or .>/sheet.png)
"""
import argparse
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "public", "fonts", "Manrope-SemiBold.ttf")
BG = (20, 22, 25)
FG = (235, 235, 235)
GUIDE = (255, 80, 80)


def parse_frames(spec):
    out = []
    for part in [p.strip() for p in spec.split(",") if p.strip()]:
        m = re.fullmatch(r"(\d+)(?:-(\d+))?(?::(\d+))?", part)
        if not m:
            raise SystemExit(f'bad --frames part "{part}"')
        a = int(m.group(1))
        b = int(m.group(2)) if m.group(2) else a
        step = int(m.group(3) or 1)
        out.extend(range(a, b + 1, step))
    return out


def collect(inputs, frames):
    files = []
    for p in inputs:
        if os.path.isdir(p):
            names = sorted(n for n in os.listdir(p) if n.lower().endswith((".png", ".jpg", ".jpeg")) and n != "sheet.png")
            if frames is not None:
                want = {f"f{f:05d}" for f in frames}
                names = [n for n in names if os.path.splitext(n)[0] in want]
            files.extend(os.path.join(p, n) for n in names)
        elif os.path.isfile(p):
            files.append(p)
        else:
            raise SystemExit(f"not found: {p}")
    return files


def label_of(path, fps=30):
    stem = os.path.splitext(os.path.basename(path))[0]
    m = re.fullmatch(r"f(\d{5})", stem)
    if m:
        f = int(m.group(1))
        return f"f {f}  ·  {f / fps:.2f} s"
    return stem


def main():
    ap = argparse.ArgumentParser(description="contact sheet of stills")
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("-o", "--out")
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--width", type=int, default=360)
    ap.add_argument("--frames")
    ap.add_argument("--labels")
    ap.add_argument("--safe", action="store_true")
    ap.add_argument("--title")
    a = ap.parse_args()

    files = collect(a.inputs, parse_frames(a.frames) if a.frames else None)
    if not files:
        raise SystemExit("no images")
    labels = [s.strip() for s in a.labels.split(",")] if a.labels else [label_of(f) for f in files]
    labels += [""] * (len(files) - len(labels))
    try:
        font = ImageFont.truetype(FONT, 20)
        tfont = ImageFont.truetype(FONT, 28)
    except OSError:
        font = tfont = ImageFont.load_default()

    pad, lab_h = 12, 34
    tiles = []
    for f in files:
        im = Image.open(f).convert("RGB")
        h = round(im.height * a.width / im.width)
        im = im.resize((a.width, h), Image.LANCZOS)
        if a.safe:
            d = ImageDraw.Draw(im)
            k = a.width / 1080
            for y in (220, 1500):
                d.line([(0, round(y * k)), (a.width, round(y * k))], fill=GUIDE, width=1)
            d.line([(round(960 * k), 0), (round(960 * k), h)], fill=GUIDE, width=1)
        tiles.append(im)
    cols = max(1, min(a.cols, len(tiles)))
    rows = (len(tiles) + cols - 1) // cols
    th = max(t.height for t in tiles)
    top = 56 if a.title else pad
    sheet = Image.new("RGB", (pad + cols * (a.width + pad), top + rows * (th + lab_h + pad)), BG)
    d = ImageDraw.Draw(sheet)
    if a.title:
        d.text((pad, 12), a.title, fill=FG, font=tfont)
    for i, im in enumerate(tiles):
        x = pad + (i % cols) * (a.width + pad)
        y = top + (i // cols) * (th + lab_h + pad)
        sheet.paste(im, (x, y))
        d.text((x + 2, y + th + 5), labels[i], fill=FG, font=font)
    out = a.out or os.path.join(next((p for p in a.inputs if os.path.isdir(p)), "."), "sheet.png")
    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
    sheet.save(out)
    print(f"sheet: {out}  ({sheet.width}x{sheet.height}, {len(tiles)} tiles)")


if __name__ == "__main__":
    sys.exit(main())
