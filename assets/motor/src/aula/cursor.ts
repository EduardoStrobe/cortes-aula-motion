// The doctor's mouse pointer (src/data/cursor-<id>.json): raw, smoothed and path accessors. ENGINE-OWNED.
// Values are the cursor TIP in slide space, one entry per frame of the cut, null = hidden. The capture updates the
// pointer at ~15 fps, so raw values repeat in pairs.
import type { CursorData, Pt } from "./types";

export interface CursorApi {
  /** Raw sample of frame f (null = hidden / out of range). */
  raw(f: number): Pt | null;
  /** true when frame f has a sample. */
  visible(f: number): boolean;
  /** Number of consecutive frames around f (inclusive) without a sample; 0 when f has one. */
  hiddenRun(f: number): number;
  /** Smoothed position: mean of the samples in [f - half, f + half] with half = (window - 1) / 2 (default
   *  window 7, as SYSTEM 8.15). Where f itself has no sample, the nearest sample within `hold` frames is used
   *  (default 10); otherwise null. */
  smooth(f: number, window?: number, hold?: number): Pt | null;
  /** Position for anything that must sit ON the recorded arrow (CursorHalo, pointer dots): the sample of frame f
   *  itself, blended 70 / 15 / 15 with its two neighbours. The arrow in the footage only moves every second frame
   *  and jumps 60-100 slide px per step when he sweeps; the 7-frame mean of `smooth()` trailed it by 30-90 px
   *  (reviewers saw "two pointers"). `follow` is never further than 15 % of one step from the arrow. Where f has
   *  no sample the nearest one within `hold` frames is used (default 10); otherwise null. */
  follow(f: number, hold?: number): Pt | null;
  /** Pen path for Trace/MarkerTrace: samples of frames f0..f1, consecutive duplicates dropped, then an
   *  `avg`-sample moving average (default 5; end points are kept). */
  path(f0: number, f1: number, avg?: number): Pt[];
  /** Intervals [a, b] with samples, as listed in the JSON. */
  intervals: [number, number][];
}

export const makeCursor = (data: CursorData): CursorApi => {
  const fr = data.frames;
  const raw = (f: number): Pt | null => {
    const i = Math.round(f);
    const v = i >= 0 && i < fr.length ? fr[i] : null;
    return v ? [v[0], v[1]] : null;
  };
  const visible = (f: number) => raw(f) !== null;
  const hiddenRun = (f: number) => {
    if (visible(f)) return 0;
    let a = Math.round(f);
    let b = a;
    while (a - 1 >= 0 && !fr[a - 1]) a--;
    while (b + 1 < fr.length && !fr[b + 1]) b++;
    return b - a + 1;
  };
  const smooth = (f: number, window = 7, hold = 10): Pt | null => {
    let c = Math.round(f);
    if (!visible(c)) {
      let found = -1;
      for (let d = 1; d <= hold && found < 0; d++) {
        if (visible(c - d)) found = c - d;
        else if (visible(c + d)) found = c + d;
      }
      if (found < 0) return null;
      c = found;
    }
    const half = Math.floor((window - 1) / 2);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = c - half; i <= c + half; i++) {
      const v = raw(i);
      if (v) {
        sx += v[0];
        sy += v[1];
        n++;
      }
    }
    return n ? [sx / n, sy / n] : null;
  };
  const follow = (f: number, hold = 10): Pt | null => {
    let c = Math.round(f);
    if (!visible(c)) {
      let found = -1;
      for (let d = 1; d <= hold && found < 0; d++) {
        if (visible(c - d)) found = c - d;
        else if (visible(c + d)) found = c + d;
      }
      if (found < 0) return null;
      c = found;
    }
    const p = raw(c) as Pt;
    const a = raw(c - 1) ?? p;
    const b = raw(c + 1) ?? p;
    return [0.7 * p[0] + 0.15 * (a[0] + b[0]), 0.7 * p[1] + 0.15 * (a[1] + b[1])];
  };
  const path = (f0: number, f1: number, avg = 5): Pt[] => {
    const pts: Pt[] = [];
    for (let i = Math.round(f0); i <= Math.round(f1); i++) {
      const v = raw(i);
      if (!v) continue;
      const last = pts[pts.length - 1];
      if (!last || last[0] !== v[0] || last[1] !== v[1]) pts.push(v);
    }
    if (pts.length < 3 || avg <= 1) return pts;
    const half = Math.floor((avg - 1) / 2);
    return pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) return p;
      const h = Math.min(half, i, pts.length - 1 - i);
      let sx = 0;
      let sy = 0;
      for (let k = i - h; k <= i + h; k++) {
        sx += pts[k][0];
        sy += pts[k][1];
      }
      return [sx / (2 * h + 1), sy / (2 * h + 1)] as Pt;
    });
  };
  return { raw, visible, hiddenRun, smooth, follow, path, intervals: data.visible };
};
