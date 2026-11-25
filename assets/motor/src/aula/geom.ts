// Small geometry helpers shared by engine, elements and ALT. ENGINE-OWNED.
import type { Pt, Rect } from "./types";

/** SVG path data of a Catmull-Rom spline through the points (converted to cubic Beziers; tension 0.5 = the
 *  standard uniform spline: control points at +-(neighbour difference)/6). */
export const catmullRomPath = (pts: Pt[], tension = 0.5): string => {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const k = tension / 3;
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = p2[1] - (p3[1] - p1[1]) * k;
    d += ` C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return d;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Length of the polyline through the points (good enough to time draw-ons). */
export const polylineLength = (pts: Pt[]): number => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};

/** Point at fraction t (0..1) of the polyline's length. */
export const pointAlong = (pts: Pt[], t: number): Pt => {
  if (pts.length === 0) return [0, 0];
  const total = polylineLength(pts);
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= seg && seg > 0) {
      const k = want / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    }
    want -= seg;
  }
  return pts[pts.length - 1];
};

/** SVG path data of a rounded rectangle x0,y0,x1,y1 (clockwise). */
export const roundRectPath = ([x0, y0, x1, y1]: Rect, r: number): string => {
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  return `M ${x0 + rr} ${y0} H ${x1 - rr} A ${rr} ${rr} 0 0 1 ${x1} ${y0 + rr} V ${y1 - rr} A ${rr} ${rr} 0 0 1 ${x1 - rr} ${y1}`
    + ` H ${x0 + rr} A ${rr} ${rr} 0 0 1 ${x0} ${y1 - rr} V ${y0 + rr} A ${rr} ${rr} 0 0 1 ${x0 + rr} ${y0} Z`;
};

export const rectCenter = ([x0, y0, x1, y1]: Rect): Pt => [(x0 + x1) / 2, (y0 + y1) / 2];
export const rectUnion = (rects: Rect[]): Rect => [
  Math.min(...rects.map((r) => r[0])), Math.min(...rects.map((r) => r[1])),
  Math.max(...rects.map((r) => r[2])), Math.max(...rects.map((r) => r[3])),
];
