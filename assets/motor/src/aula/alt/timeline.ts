// ALT frame -> geometry and light: panel top edge, film window, camera (hook settle + pan + push, moves, breathing,
// punches, closing push) and the relay / join-dip light state. Pure functions of (AltResolved, frame).
// OWNER: ALT author.
// REVIEW ROUND 1: the hook was a still poster after f 8 and the body sat on one framing for 10-12 s (the "always-on
// drift" of 0.5 % per second was sub-pixel). Now: the hook camera lands (x 1.07 -> 1 over 16 f), pans cam -> camTo
// and pushes to x 1.10 by H; after every body move the camera BREATHES (as the primary engine does); the closing
// hold pushes x 1.05; the room is LIT on frame 0 (poster frame shows the radiograph) and the relay flicker is a dip.
import { lerpCam, makeView, S_MAX, type NumCam, type ScreenRect, type View } from "../camera";
import { bump, clamp01, FPS, INOUT, lerp, LINEAR, OUT, prog } from "../tokens";
import type { AltResolved } from "./resolve";
import { A, ALT_CLOSING, FLICK, LIT, OFF } from "./tokens";

/** Panel top edge: 620 in the hook, 620 -> 300 over H..H+18 (OUT), 300 -> 620 over P..P+18 (INOUT). */
export const panelTopAt = (r: AltResolved, frame: number): number => {
  const { bodyTop, bandTop } = A.panel;
  if (frame < r.P) return lerp(bandTop, bodyTop, prog(frame, r.H, A.edgeDur, OUT));
  return lerp(bodyTop, bandTop, prog(frame, r.P, A.edgeDur, INOUT));
};
/** Film window = panel inset by 20 px (x 50-1030, bottom 1184). */
export const windowAt = (r: AltResolved, frame: number): ScreenRect => {
  const top = panelTopAt(r, frame) + A.inset;
  return { x: A.panel.x0 + A.inset, y: top, w: A.panel.x1 - A.panel.x0 - 2 * A.inset, h: A.panel.bottom - A.inset - top };
};

/** breathing after a settled body move: s x (1 + BREATH (1 - cos) / 2), one cycle every BREATH_PERIOD frames */
const BREATH = 0.06;
const BREATH_PERIOD = 240;
/** keys at or after P (closing band) keep a gentle drift, then the hold pushes x HOLD_PUSH over T+30 .. T+102 */
const DRIFT_PER_S = 0.005;
const HOLD_PUSH = 1.05;
const EASES = { inout: INOUT, out: OUT, linear: LINEAR } as const;

/** value of camera segment i (-1 = hook band) at frame f */
const seg = (r: AltResolved, i: number, f: number): NumCam => {
  if (i < 0) {
    // hook: the band camera lands (x 1.07 -> 1, 16 f), travels cam -> camTo and pushes to x hookPush at H
    const t = clamp01(f / r.H);
    const c = lerpCam(r.hookCam, r.hookCamTo, INOUT(t));
    const land = lerp(1.07, 1, prog(f, 0, 16, OUT));
    return { ...c, s: Math.min(S_MAX, c.s * land * lerp(1, r.hookPush, t)) };
  }
  const k = r.camKeys[i];
  const settle = k.f + k.dur;
  if (f < settle) return lerpCam(seg(r, i - 1, k.f), k.to, EASES[k.ease]((f - k.f) / k.dur));
  if (k.f >= r.P) {
    const drift = 1 + (DRIFT_PER_S * (Math.min(f, r.T) - settle)) / FPS;
    const push = lerp(1, HOLD_PUSH, INOUT(clamp01((f - (r.T + ALT_CLOSING.push0)) / (r.total - r.T - ALT_CLOSING.push0))));
    return { ...k.to, s: Math.min(S_MAX, k.to.s * drift * push) };
  }
  const breath = 1 + (BREATH * (1 - Math.cos((2 * Math.PI * (f - settle)) / BREATH_PERIOD))) / 2;
  return { ...k.to, s: Math.min(S_MAX, k.to.s * breath) };
};

/** camera punch (s x amount, 6 f in OUT, 20 f back INOUT) */
const punchAt = (r: AltResolved, frame: number): number => {
  let m = 1;
  for (const p of r.punches) {
    const d = frame - p.f;
    if (d < 0 || d > 26) continue;
    const a = d <= 6 ? OUT(d / 6) : 1 - INOUT((d - 6) / 20);
    m = Math.max(m, 1 + (p.amount - 1) * a);
  }
  return m;
};

export const camAt = (r: AltResolved, frame: number): NumCam => {
  let i = -1;
  r.camKeys.forEach((k, j) => {
    if (k.f <= frame) i = j;
  });
  const c = seg(r, i, frame);
  return { ...c, s: Math.min(S_MAX, c.s * punchAt(r, frame)) };
};
/** The film view (window rect + camera) at `frame`. */
export const viewAt = (r: AltResolved, frame: number): View => makeView(camAt(r, frame), windowAt(r, frame));

export interface Light {
  /** panel fill opacity */
  fill: number;
  /** film brightness */
  film: number;
  /** 0..1 strength of the panel's soft halo (lit = 1) */
  glow: number;
  /** 0 = lit room, 1 = relay off after T (used to fade the progress hairline) */
  off: number;
}

/** Relay: the room is lit on frames 0-1 (poster frame), flickers at f 2-3 (click at f 2) and f 6-7, then stays
 *  lit; OFF over T..T+8; join dip (film brightness 1 -> 0.7 -> 1 over 4 f); re-hang dip (1 -> 0.8 -> 1, 8 f). */
export const lightAt = (r: AltResolved, frame: number): Light => {
  const lit = { ...LIT, fill: r.panelFill };
  const flick = { ...FLICK, fill: FLICK.fill * r.panelFill };
  const half = { fill: lerp(flick.fill, lit.fill, 0.5), film: 0.65, glow: 0.6 };
  let st: { fill: number; film: number; glow: number };
  let off = 0;
  if (frame < 2) st = lit;
  else if (frame < 4) st = flick;
  else if (frame < 6) st = lit;
  else if (frame < 8) st = half;
  else if (frame < r.T) st = lit;
  else if (frame < r.T + 2) st = flick;
  else if (frame < r.T + 4) st = lit;
  else {
    off = clamp01((frame - (r.T + 4)) / 4);
    st = { fill: lerp(lit.fill, OFF.fill, off), film: lerp(lit.film, OFF.film, off), glow: lerp(lit.glow, OFF.glow, off) };
  }
  let film = st.film;
  if (frame >= 8 && frame < r.T) {
    for (const j of r.joins) {
      const d = frame - j;
      if (d >= 0 && d < 4) film *= 1 - 0.3 * [0.5, 1, 0.5, 0.15][d];
    }
    for (const b of r.beats) {
      if (b.el === "Rehang") film *= 1 - 0.2 * bump(frame, b.at, 8);
    }
  }
  return { fill: st.fill, film, glow: st.glow, off };
};

/** Footage frame shown by the lightbox (and by the Lupa): frozen on the last speech frame in the closing. */
export const videoFrameAt = (r: AltResolved, frame: number): number => Math.min(frame, r.T - 1);

/** Breathing of the kept accent mark in the closing hold: 1 -> 0 -> 1 every 40 f from T+20 (callers map it to
 *  opacity 1 -> 0.45 and a small swell; the old 1 -> 0.7 was not perceptible). Returns the 0..1 "dimmed" amount. */
export const breatheAt = (r: AltResolved, frame: number): number => {
  const d = frame - (r.T + 20);
  if (d <= 0) return 0;
  return (1 - Math.cos((2 * Math.PI * d) / 40)) / 2;
};
