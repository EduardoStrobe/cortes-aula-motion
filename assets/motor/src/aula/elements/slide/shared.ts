// Helpers shared by the slide-group elements (Ring, Brackets, Trace, Guide, CursorHalo, ScanLine, Spotlight,
// Compare). OWNER: slide-group element author. Pure functions only: a frame is a function of ctx.
import { EXIT_FRAMES, type Anchor, type CursorApi, type Pt } from "../api";

/** The `accent` token (#60AFF0) at alpha `a` (ScanLine tail: "accent 12 % -> 0"). No new hue is introduced.
 *  Lives in tokens.ts now (it follows the look's on-film palette); re-exported so the slide elements keep their import. */
export { accentA } from "../api";

/** Extra width (screen px) of the dim(0.5) under-stroke drawn below the WHITE 2 px marks (brackets, guides, ghost
 *  traces). SYSTEM 1 only prescribes the under-stroke for the accent marks; on bright bone the white lines
 *  vanished in the lab stills, so they get the same legibility aid (2 px line -> 4 px under-stroke). Set to 0 to
 *  go back to the bare white line. */
export const WHITE_UNDER = 2;

/** Breathe (SYSTEM 6): scale 1 -> 1 + amp -> 1, `period`-frame sine loop that starts (at scale 1) on `start`. */
export const breatheScale = (frame: number, start: number, amp = 0.04, period = 45): number =>
  frame <= start ? 1 : 1 + amp * (0.5 - 0.5 * Math.cos((2 * Math.PI * (frame - start)) / period));

/** Opacity after a list of `fadeTo` steps: each step moves the opacity to its value over `dur` frames (linear),
 *  starting on its anchor. Before the first step the opacity is 1. */
export const stepOpacity = (
  ctx: { frame: number; fr(a: Anchor): number },
  steps: { at: Anchor; opacity: number }[] | undefined,
  dur = 8,
): number => {
  if (!steps || !steps.length) return 1;
  const list = steps.map((s) => ({ f: ctx.fr(s.at), o: s.opacity })).sort((a, b) => a.f - b.f);
  let o = 1;
  for (const s of list) {
    const k = Math.max(0, Math.min(1, (ctx.frame + 1 - s.f) / dur));
    o += (s.o - o) * k;
  }
  return o;
};

/** true when the mark must already be gone because the footage has HARD-JOINED to another picture during its
 *  6-frame exit (SYSTEM 3.3; c3: "every slide-A element is removed ON f 231"). A mark whose `until` is on a join,
 *  or up to 6 frames before one, is cut on the join frame instead of fading over the new picture. */
export const cutByJoin = (ctx: { frame: number; until: number; joins: number[] }): boolean =>
  ctx.joins.some((j) => j >= ctx.until && j <= ctx.until + EXIT_FRAMES && ctx.frame >= j);

/** Dense polyline along the uniform Catmull-Rom spline through `pts` (same curve as api.catmullRomPath). Used
 *  where a path must be CUT at a fraction of its length (draw-on of dashed lines, head dots). */
export const sampleSpline = (pts: Pt[]): Pt[] => {
  if (pts.length < 3) return pts.map((p) => [p[0], p[1]] as Pt);
  const out: Pt[] = [[pts[0][0], pts[0][1]]];
  const k = 0.5 / 3;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    const n = Math.max(4, Math.min(24, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 5)));
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      out.push([a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0], a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1]]);
    }
  }
  return out;
};

/** The first fraction `t` (0..1, by length) of a polyline; the last point is the exact cut point. */
export const cutPolyline = (pts: Pt[], t: number): Pt[] => {
  if (pts.length < 2 || t >= 1) return pts;
  if (t <= 0) return [pts[0]];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let want = t * total;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= seg) {
      const k = seg > 0 ? want / seg : 0;
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]);
      return out;
    }
    want -= seg;
    out.push(pts[i]);
  }
  return out;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
/** SVG path data of a polyline. */
export const polyPath = (pts: Pt[]): string =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"} ${r2(p[0])} ${r2(p[1])}`).join(" ");

/** CursorHalo visibility (SYSTEM 8.15): 1 while the pointer has samples or is hidden for <= 10 frames; inside a
 *  longer hidden run [a, b] the halo fades out over the first 6 frames and back in over the last 6. */
export const pointerFade = (cursor: CursorApi, f: number): number => {
  const i = Math.round(f);
  if (cursor.visible(i)) return 1;
  const run = cursor.hiddenRun(i);
  if (run <= 10) return 1;
  let a = i;
  while (a - 1 >= 0 && !cursor.visible(a - 1)) a--;
  const b = a + run - 1;
  const out = a > 0 ? 1 - (i - a + 1) / 6 : 0;
  const back = cursor.visible(b + 1) ? 1 - (b - i + 1) / 6 : 0;
  return Math.max(0, Math.min(1, Math.max(out, back)));
};
