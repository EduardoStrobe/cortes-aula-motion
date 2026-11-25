#!/usr/bin/env python3
"""Audible word onsets -> src/data/onsets.json   (py -3.12 scripts/onsets.py [c1 .. c6])

The transcription (src/data/<id>.json, palavras[].s) stretches the START of a word that follows silence backwards
into the pause: c2 "Cadê" is listed at f 964 but the voice starts at f 978; c6 "Então," 213 vs 238; c4 "corpo" 1058 vs
1074. Every caption / chip / camera move anchored to such a word therefore fired 6-25 frames before the voice
(SYSTEM 0.6 allows +-2).

For every word this script looks at the mastered speech track public/<id>/audio.wav: 20 ms RMS windows, 5 ms hop.
onset = start of the first run above THRESH that lasts >= 100 ms or reaches -28 dBFS, searched from the listed start
to 3 frames past the listed end (short words such as c2 "O" 339-355 are listed entirely inside the pause; their
sound starts where the NEXT word is listed). The onset is clamped to the next word's listed start, so the word
order never changes. When the onset is >= MIN_SHIFT frames after the listed start (i.e. the listed start sits in
silence), it is written to onsets.json:

    { "c2": { "0": 0.337, "12": 5.61, ... } }      word index -> onset in seconds

src/aula/data.ts applies it at load time: palavras[i].s becomes the onset and the transcription's value is kept
as palavras[i].s0. Anchors RESOLVE to the onset; the storyboard's expected frame "f" is still checked against the
transcription value (anchors.ts), so no storyboard has to be re-keyed. Absolute frames ({ "f": N } anchors,
closing.preRoll, captions.hide, cursor intervals, hook.exit) do NOT move.
"""
import json
import os
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
THRESH_DB = -42.0      # speech is mastered to -14 LUFS; the pauses of these recordings sit at -70 .. -80 dBFS
WIN = 0.020
HOP = 0.005
RUN_MIN = 0.100        # a run this long above THRESH is speech ...
PEAK_DB = -28.0        # ... or a shorter one that gets this loud
MIN_SHIFT = 3          # frames; smaller differences are inside the sync tolerance and are left alone
PAUSE = 6              # frames of listed gap before a word that make it "the first word after a pause"
MIN_SHIFT_MID = 6      # frames; minimum stretch for a word that is NOT preceded by a listed pause


def envelope(path):
    with wave.open(path, "rb") as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        if w.getsampwidth() != 2:
            raise SystemExit(f"{path}: expected 16-bit PCM")
        x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768.0
    x = x.reshape(-1, ch).mean(axis=1)
    win, hop = int(sr * WIN), int(sr * HOP)
    c = np.concatenate([[0.0], np.cumsum(x * x)])
    starts = np.arange(0, len(x) - win, hop)
    rms = np.sqrt((c[starts + win] - c[starts]) / win)
    db = 20 * np.log10(np.maximum(rms, 1e-9))
    return db, hop / sr


def onset(db, dt, s, e):
    """Start of the first SPEECH run at or after s: consecutive windows above THRESH that either last >= RUN_MIN or
    reach PEAK_DB (a 2-frame breath / mouth click at -35 dBFS after the previous word is not an onset: c6 f 214).
    None when no such run starts before e."""
    i0 = max(0, int(round(s / dt)))
    i1 = min(len(db) - 1, int(round(e / dt)))
    need = max(1, int(round(RUN_MIN / dt)))
    i = i0
    while i <= i1:
        if db[i] <= THRESH_DB:
            i += 1
            continue
        j = i
        while j + 1 < len(db) and db[j + 1] > THRESH_DB and j - i < 4 * need:
            j += 1
        if j - i + 1 >= need or db[i:j + 1].max() >= PEAK_DB:
            # window i is the first 20 ms window above the threshold: the sound starts near its END
            return i * dt + WIN * 0.5
        i = j + 1
    return None


def main():
    ids = [a for a in sys.argv[1:] if a.startswith("c")] or ["c1", "c2", "c3", "c4", "c5", "c6"]
    dst = os.path.join(ROOT, "src", "data", "onsets.json")
    out = {}
    if os.path.exists(dst):
        out = {k: v for k, v in json.load(open(dst, encoding="utf-8")).items() if not k.startswith("_")}
    for cid in ids:
        data = json.load(open(os.path.join(ROOT, "src", "data", f"{cid}.json"), encoding="utf-8"))
        db, dt = envelope(os.path.join(ROOT, "public", cid, "audio.wav"))
        res = {}
        for i, p in enumerate(data["palavras"]):
            s, e = p["s"], p["e"]
            nxt = data["palavras"][i + 1] if i + 1 < len(data["palavras"]) else None
            lim = min(e + 3 / FPS, nxt["e"]) if nxt else e
            t = onset(db, dt, s, lim)
            if t is None:
                continue
            if nxt:
                t = min(t, nxt["s"])
            f0, f1 = round(s * FPS), round(t * FPS)
            prev_e = data["palavras"][i - 1]["e"] if i else 0.0
            after_pause = i == 0 or round((s - prev_e) * FPS) >= PAUSE
            # mid-phrase words only move when the stretch is unmistakable (a stop closure of 3-5 frames before a
            # "p" / "c" is part of the word and stays where the transcription put it)
            if f1 - f0 >= (MIN_SHIFT if after_pause else MIN_SHIFT_MID):
                res[str(i)] = round(t, 3)
                print(f"[{cid}] #{i:3d} {p['w']!r:16} listed f{f0:4d} -> audible f{f1:4d} (+{f1 - f0:2d} f)   gap before: "
                      f"{round((s - prev_e) * FPS):3d} f")
        out[cid] = res
        print(f"[{cid}] {len(res)} of {len(data['palavras'])} word starts moved")
    doc = ("Audible onsets of words whose transcribed start sits in silence (seconds, by word index). Written by "
           "scripts/onsets.py from public/<id>/audio.wav; applied by src/aula/data.ts (palavras[i].s = onset, "
           "s0 = transcription). Do not edit by hand: re-run the script.")
    with open(dst, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"_doc": doc, **out}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"written {dst}")


if __name__ == "__main__":
    main()
