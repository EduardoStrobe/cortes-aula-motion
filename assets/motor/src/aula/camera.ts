// Slide-space camera maths (SYSTEM 3.1). ENGINE-OWNED; reusable by ALT (pass the lightbox window as `rect`).
//   screenX = rect.cx + (x - cx) * s        screenY = rect.cy + (y - cy) * s
// A View is the same mapping in "offset" form: screen = (ox + x * s, oy + y * s), plus the rect it is drawn in.
import type { Cam, Pt, Rect } from "./types";

export interface ScreenRect { x: number; y: number; w: number; h: number }
export interface View {
  /** screen rect the view is clipped to (stage, pane, lightbox window) */
  rect: ScreenRect;
  /** screen px per slide px */
  s: number;
  /** screen position of slide (0,0) */
  ox: number; oy: number;
  /** slide point at the centre of `rect` */
  cx: number; cy: number;
}
export interface NumCam { cx: number; cy: number; s: number }

export const S_MAX = 2.0;
export const isPin = (c: Cam): c is { pin: Pt; at: Pt; s: number } => (c as { pin?: Pt }).pin !== undefined;

/** Numeric camera (slide centre + scale) of `cam` for a view centred at screen (centerX, centerY).
 *  `s` overrides the camera's own scale (drift / push-in) while a pin stays held at its screen point. */
export const numCam = (cam: Cam, centerX: number, centerY: number, s: number = cam.s): NumCam => {
  if (isPin(cam)) {
    return { cx: cam.pin[0] - (cam.at[0] - centerX) / s, cy: cam.pin[1] - (cam.at[1] - centerY) / s, s };
  }
  return { cx: cam.cx, cy: cam.cy, s };
};

export const makeView = (c: NumCam, rect: ScreenRect): View => {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  return { rect, s: c.s, ox: centerX - c.cx * c.s, oy: centerY - c.cy * c.s, cx: c.cx, cy: c.cy };
};
/** View of a storyboard camera inside a screen rect. */
export const viewFromCam = (cam: Cam, rect: ScreenRect, s?: number): View =>
  makeView(numCam(cam, rect.x + rect.w / 2, rect.y + rect.h / 2, s ?? cam.s), rect);

export const toScreen = (v: View, p: Pt): Pt => [v.ox + p[0] * v.s, v.oy + p[1] * v.s];
export const toSlide = (v: View, p: Pt): Pt => [(p[0] - v.ox) / v.s, (p[1] - v.oy) / v.s];
export const rectToScreen = (v: View, r: Rect): ScreenRect => ({
  x: v.ox + r[0] * v.s, y: v.oy + r[1] * v.s, w: (r[2] - r[0]) * v.s, h: (r[3] - r[1]) * v.s,
});
/** CSS transform of a slide-space (1367x912, origin 0 0) box for this view, in canvas coordinates. */
export const viewCss = (v: View) => `translate(${v.ox}px, ${v.oy}px) scale(${v.s})`;
/** SVG transform attribute for a <g> holding slide-space drawing inside a canvas-space <svg>. */
export const viewSvg = (v: View) => `translate(${v.ox} ${v.oy}) scale(${v.s})`;

export const lerpCam = (a: NumCam, b: NumCam, t: number): NumCam => ({
  cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, s: a.s + (b.s - a.s) * t,
});
