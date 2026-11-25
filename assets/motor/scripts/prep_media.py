#!/usr/bin/env python3
"""Aula media prep (run with:  py -3.12 scripts/prep_media.py [c1 c2 ...] [--force] [--only slide,cam,audio,sfx]).

For every cut id (default c1..c6) it derives, from public/<id>/video.mp4 (1920x1080, 30 fps, speech audio):

  public/<id>/slide.mp4   slide proxy. Source crop x6 y84 w1368 h912 (one extra column on the LEFT because yuv420p
                          needs an even width; the slide region of SYSTEM 3 is x7 y84 w1367 h912).
                          => slide-space x = proxy x - 1, slide-space y = proxy y.  (tokens: SLIDE_PROXY.dx = -1)
                          libx264 crf 12, -g 10, no B-frames, no audio.
  public/<id>/cam.mp4     webcam tile proxy. Source crop x1502 y389 w418 h302 (tile of SYSTEM 3 is x1503 w417; one
                          extra column on the LEFT) => tile-local x = proxy x - 1.  (tokens: CAM_PROXY.dx = -1)
                          libx264 crf 12, -g 10, no audio.
  public/<id>/audio.wav   speech, 48 kHz stereo pcm_s16le, TWO-PASS loudnorm I=-14 LUFS, TP=-1.5 dBTP, LRA=11
                          (pass 1 measures, pass 2 applies the measured values with linear=true), preceded by a
                          peak limiter when needed so that pass 2 really stays linear, and followed by a linear
                          trim so that the WRITTEN file reads -14.0 LUFS on ffmpeg's ebur128 meter (see prep_audio).
  public/sfx/tick.wav, pop.wav, whoosh.wav   cue sounds of SYSTEM 11 (synthesised, no downloads).

Prints the final measured loudness of every audio.wav. No third-party Python packages needed.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
IDS = ["c1", "c2", "c3", "c4", "c5", "c6"]

# x264 settings shared by both proxies: short GOP + no B-frames => fast frame-accurate seeking in OffthreadVideo.
X264 = ["-c:v", "libx264", "-preset", "medium", "-crf", "12", "-g", "10", "-keyint_min", "10", "-sc_threshold", "0",
        "-bf", "0", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-color_range", "tv", "-movflags", "+faststart", "-an", "-fps_mode", "passthrough"]

LOUD = {"I": -14.0, "TP": -1.5, "LRA": 11.0}


def run(cmd, capture=False):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8",
                       errors="replace")
    if p.returncode != 0:
        sys.stderr.write(p.stderr[-3000:])
        raise SystemExit("command failed: " + " ".join(cmd))
    return p.stderr if capture else None


def loudnorm_json(stderr):
    m = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", stderr, flags=re.S)
    if not m:
        raise SystemExit("could not parse loudnorm output")
    return json.loads(m[-1])


def nb_frames(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames",
                        "-of", "csv=p=0", path], stdout=subprocess.PIPE, text=True)
    return int(p.stdout.strip().split(",")[0])


def prep_video(cid, which, force):
    src = os.path.join(PUBLIC, cid, "video.mp4")
    jobs = {
        "slide": ("slide.mp4", "crop=1368:912:6:84"),
        "cam": ("cam.mp4", "crop=418:302:1502:389"),
    }
    name, vf = jobs[which]
    dst = os.path.join(PUBLIC, cid, name)
    if os.path.exists(dst) and not force:
        print(f"[{cid}] {name}: exists (use --force to rebuild)")
        return
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", vf] + X264 + [dst])
    a, b = nb_frames(src), nb_frames(dst)
    if a != b:
        raise SystemExit(f"[{cid}] {name}: frame count {b} differs from source {a}")
    print(f"[{cid}] {name}: {b} frames, {os.path.getsize(dst) / 1e6:.1f} MB")


def ebur128(path):
    """Integrated loudness (LUFS) and true peak (dBTP) of a file with ffmpeg's EBU R128 meter."""
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"],
              capture=True)
    tail = err[err.rindex("Summary:"):]
    i = float(re.search(r"I:\s*(-?[\d.]+) LUFS", tail).group(1))
    tp = float(re.search(r"Peak:\s*(-?[\d.]+) dBFS", tail).group(1))
    lra = float(re.search(r"LRA:\s*(-?[\d.]+) LU", tail).group(1))
    return i, tp, lra


def prep_audio(cid, force):
    src = os.path.join(PUBLIC, cid, "video.mp4")
    dst = os.path.join(PUBLIC, cid, "audio.wav")
    tmp = os.path.join(PUBLIC, cid, "audio.pass2.tmp.wav")
    base = f"loudnorm=I={LOUD['I']}:TP={LOUD['TP']}:LRA={LOUD['LRA']}"

    def measure_file(path, pre=""):
        return loudnorm_json(run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af",
                                  pre + base + ":print_format=json", "-f", "null", "-"], capture=True))

    if not os.path.exists(dst) or force:
        m0 = measure_file(src)
        gain = LOUD["I"] - float(m0["input_i"])
        # (1) If the linear gain would push the true peak above the target, loudnorm silently falls back to its
        #     DYNAMIC mode (gain riding). To keep pass 2 LINEAR a look-ahead limiter shaves only the highest speech
        #     peaks first; its ceiling is lowered in a closed loop.
        # (2) loudnorm's own meter under-reads short files (c5: it says -14.0 where ffmpeg's ebur128 filter and an
        #     independent BS.1770-4 implementation both say -13.5). The file is therefore trimmed with a plain
        #     linear gain to -14.0 LUFS as measured by ebur128, and the loop only ends when the WRITTEN file
        #     measures |I + 14| <= 0.1 LU and TP <= -1.5 dBTP on that meter.
        limit_db = None if float(m0["input_tp"]) + gain <= LOUD["TP"] else LOUD["TP"] - gain - 1.0
        for attempt in range(10):
            pre = ""
            if limit_db is not None:
                pre = f"alimiter=level_in=1:level_out=1:limit={10 ** (limit_db / 20):.5f}:attack=5:release=50:level=0,"
            m = measure_file(src, pre)                                       # pass 1 (on the limited signal)
            af = (pre + base + f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
                  f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json")
            m2 = loudnorm_json(run(["ffmpeg", "-y", "-hide_banner", "-nostats", "-i", src, "-vn", "-af", af,
                                    "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", tmp], capture=True))   # pass 2
            mode = m2.get("normalization_type")
            i1, _, _ = ebur128(tmp)
            trim = LOUD["I"] - i1
            run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-af", f"volume={trim:.3f}dB",
                 "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", dst])                                    # trim
            i2, tp2, _ = ebur128(dst)
            over = tp2 - LOUD["TP"]
            print(f"[{cid}] audio.wav try {attempt + 1}: limiter={'off' if limit_db is None else '%.2f dBFS' % limit_db}"
                  f" loudnorm mode={mode} trim={trim:+.2f} dB -> I={i2:.1f} LUFS TP={tp2:.1f} dBTP (ebur128)")
            if mode == "linear" and over <= 0.0 and abs(i2 - LOUD["I"]) <= 0.1:
                break
            if limit_db is None:
                limit_db = LOUD["TP"] - gain - 1.0
            else:
                limit_db -= max(over, 0.0) + 0.4
        else:
            raise SystemExit(f"[{cid}] audio.wav: could not reach the target in 10 tries")
        if os.path.exists(tmp):
            os.remove(tmp)
        print(f"[{cid}] audio.wav: source I={m0['input_i']} LUFS TP={m0['input_tp']} dBTP LRA={m0['input_lra']} (loudnorm meter)")
    # final check: measure the written file (EBU R128 meter; loudnorm's meter shown for reference)
    i, tp, lra = ebur128(dst)
    ln = measure_file(dst)
    print(f"[{cid}] audio.wav FINAL: I={i:.1f} LUFS, TP={tp:.1f} dBTP, LRA={lra:.1f} LU (ebur128)"
          f"   [loudnorm meter: I={ln['input_i']}, TP={ln['input_tp']}]")
    return {"input_i": f"{i:.1f}", "input_tp": f"{tp:.1f}", "input_lra": f"{lra:.1f}"}


def prep_sfx(force):
    d = os.path.join(PUBLIC, "sfx")
    os.makedirs(d, exist_ok=True)
    # Levels. SYSTEM 11 wrote volume=-22dB / -20dB / -24dB, but lavfi's `sine` already has amplitude 1/8
    # (-18 dBFS), so those files peaked at -43 / -41 / -42 dBFS: about 40 dB under the speech peaks (-2 dBFS) and
    # measured as inaudible by every reviewer. The intent of SYSTEM 11 is "clearly there, at least 16 dB below the
    # speech". The cues now peak about 18-21 dB under the speech peak:
    #   tick  -23 dBFS peak (RMS -29)   pop  -21 dBFS peak (RMS -26)   whoosh  -20 dBFS peak (RMS -37, it is noise)
    # Measured on an audio-only render of rp-c5 (speech subtracted): tick -23.1, pop -21.1 (hook pop -24.1),
    # whoosh -20.3 dBFS per channel against a speech peak of -2.2 dBFS; mix I = -14.0 LUFS, TP -2.1 dBTP.
    # Do NOT add gain in sound.tsx (volume > 1); change the level here and re-run `--only sfx --force`.
    recipes = {
        "tick.wav": ["-f", "lavfi", "-i", "sine=f=1400:d=0.03", "-af",
                     "afade=t=out:st=0.005:d=0.025,volume=-2dB"],
        "pop.wav": ["-f", "lavfi", "-i", "sine=f=520:d=0.07", "-af",
                    "asetrate=44100*1.25,aresample=44100,afade=t=out:st=0.02:d=0.05,volume=0dB"],
        "whoosh.wav": ["-f", "lavfi", "-i", "anoisesrc=c=pink:d=0.22:seed=7", "-af",
                       # SYSTEM 11 writes "bandpass=f=900:w=600"; ffmpeg reads a bare w as Q (= 600, a 1.5 Hz
                       # wide filter: the result peaks at -75 dBFS, i.e. silence). The intended 600 Hz band needs
                       # width_type=h. seed=7 makes the file reproducible.
                       "bandpass=f=900:width_type=h:w=600,afade=t=in:d=0.08,afade=t=out:st=0.08:d=0.14,volume=-5dB"],
    }
    for name, args in recipes.items():
        dst = os.path.join(d, name)
        if os.path.exists(dst) and not force:
            print(f"[sfx] {name}: exists")
            continue
        # resampled to 48 kHz stereo so the cues match the speech track
        run(["ffmpeg", "-y", "-v", "error"] + args + ["-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", dst])
        print(f"[sfx] {name}: written")


def main():
    args = sys.argv[1:]
    force = "--force" in args
    only = None
    if "--only" in args:
        only = args[args.index("--only") + 1].split(",")
    ids = [a for a in args if re.fullmatch(r"c[1-6]", a)] or IDS

    def want(k):
        return only is None or k in only

    if want("sfx"):
        prep_sfx(force)
    summary = {}
    for cid in ids:
        if want("slide"):
            prep_video(cid, "slide", force)
        if want("cam"):
            prep_video(cid, "cam", force)
        if want("audio"):
            summary[cid] = prep_audio(cid, force)
    if summary:
        print("\nLoudness summary (target I=-14 LUFS, TP<=-1.5 dBTP):")
        for cid, f in summary.items():
            print(f"  {cid}: I={f['input_i']} LUFS  TP={f['input_tp']} dBTP  LRA={f['input_lra']} LU")


if __name__ == "__main__":
    main()
