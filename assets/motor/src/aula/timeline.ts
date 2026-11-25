// Frame -> geometry: stage rect (edges animate), stage camera (keyframes, cuts, punch, drift) and hook panes.
// Pure functions of (Resolved, frame). ENGINE-OWNED.
import { lerpCam, makeView, numCam, rectToScreen, S_MAX, viewFromCam, type NumCam, type ScreenRect, type View } from "./camera";
import { rectUnion } from "./geom";
import { REF_GEOM, REF_W, type StageGeom } from "./look";
import type { Resolved, StageRect } from "./resolve";
import { clamp01, FPS, INOUT, lerp, LINEAR, OUT, prog, Z } from "./tokens";
import type { Rect } from "./types";

const ST = Z.stage;
export const EDGE_DUR = 16;

export const stageRectOf = (top: number, bottom: number): StageRect => ({
  left: ST.x0, right: ST.x1, top, bottom, cx: ST.cx, cy: (top + bottom) / 2, w: ST.w, h: bottom - top,
});
export const STAGE_BODY = stageRectOf(ST.bodyTop, ST.bottom);
export const STAGE_SLOT = stageRectOf(ST.slotTop, ST.bottom);
export const STAGE_END = stageRectOf(ST.slotTop, ST.endBottom);

/** A stage box of geometry `g` at `frame`: hook box until H, -> body over H..H+16 (OUT), -> close over P..P+16
 *  (INOUT), -> end over T+10..T+26 (INOUT). With the reference geometry this is the approved behaviour: top 716 ->
 *  360 -> 716, bottom 1210 -> 1052 (SYSTEM 2, 6, 9, 10); the expressions are arranged so that those numbers come
 *  out bit-identical to the pre-look engine. */
const boxAt = (g: StageGeom, r: Resolved, frame: number): StageRect => {
  const pT = prog(frame, r.T + 10, EDGE_DUR, INOUT);
  let x0: number;
  let x1: number;
  let top: number;
  let bottom: number;
  if (frame < r.P) {
    const t = prog(frame, r.H, EDGE_DUR, OUT);
    x0 = lerp(g.hook.x0, g.body.x0, t);
    x1 = lerp(g.hook.x1, g.body.x1, t);
    top = lerp(g.hook.top, g.body.top, t);
    bottom = lerp(lerp(g.hook.bottom, g.body.bottom, t), g.end.bottom, pT);
  } else {
    const t = prog(frame, r.P, EDGE_DUR, INOUT);
    x0 = lerp(g.body.x0, lerp(g.close.x0, g.end.x0, pT), t);
    x1 = lerp(g.body.x1, lerp(g.close.x1, g.end.x1, pT), t);
    top = lerp(g.body.top, lerp(g.close.top, g.end.top, pT), t);
    bottom = lerp(lerp(g.body.bottom, g.close.bottom, t), g.end.bottom, pT);
  }
  return { left: x0, right: x1, top, bottom, cx: (x0 + x1) / 2, cy: (top + bottom) / 2, w: x1 - x0, h: bottom - top };
};
/** The stage rect of the REFERENCE layout (the approved one). Storyboard cameras are evaluated in it. */
export const refStageAt = (r: Resolved, frame: number): StageRect => boxAt(REF_GEOM, r, frame);
/** Current stage rect of the look that renders (ctx.stage). In a full-bleed look it is the full-width window and
 *  carries `dock` = the reference box, so docked chips keep their approved places. */
export const stageAt = (r: Resolved, frame: number): StageRect => {
  const st = boxAt(r.look.layout.stage, r, frame);
  if (!r.look.layout.bleed) return st;
  const ref = refStageAt(r, frame);
  return { ...st, dock: { left: ref.left, right: ref.right, top: ref.top, bottom: ref.bottom } };
};
const toScreenRect = (s: StageRect): ScreenRect => ({ x: s.left, y: s.top, w: s.w, h: s.h });

/** Closing slot (keys at or after P): the original gentle drift, s x (1 + 0.005 per second). Kept marks sit close
 *  to the slot's edges there (c1 ringA), so the picture must hardly move. */
const DRIFT_PER_S = 0.005;
/** Body (keys before P): the camera BREATHES after a move has settled: s x (1 + 0.08 x (1 - cos) / 2) with an
 *  8 s period, i.e. about 3 % per second at its fastest, in for 4 s and back out for 4 s. Review: the old
 *  0.5 % per second was invisible and the picture read as locked for 8-27 s stretches. A storyboard key (even one
 *  to the same target) restarts the breath from wherever it is. */
const BREATH_AMP = 0.08;
const BREATH_PERIOD = 240;
/** Closing hold (C 48..102): x 1.06 (was 1.03, not perceptible). */
const HOLD_PUSH = 0.06;
const EASES = { inout: INOUT, linear: LINEAR, out: OUT } as const;
const slotEase = (r: Resolved) => {
  const e = r.sb.hook.slot.ease;
  return e === "out" ? OUT : e === "inout" ? INOUT : LINEAR;
};

/** Scale factor of the drift `t` frames after a key that sits at frame `keyF` has settled. */
const driftMul = (r: Resolved, keyF: number, t: number): number => {
  if (t <= 0) return 1;
  if (keyF >= r.P) return 1 + (DRIFT_PER_S * t) / FPS;
  return 1 + BREATH_AMP * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH_PERIOD));
};

/** Hook life (review: "the hook freezes 0.3 s after the slam"): on top of the storyboard's slot camera the picture
 *  SETTLES from x 0.93 to x 1 over the first 16 frames (OUT) and then keeps pushing in to x 1.06 at H (linear), so
 *  something moves in every half second of the hook. A slot camera that already travels more than 15 % in scale
 *  (c4's reverse dolly) only gets the slow push. The result is clamped to s <= 2.0 by the callers. */
export const hookScaleMul = (r: Resolved, frame: number): number => {
  if (r.sb.hook.autoMotion === false) return 1;
  const slot = r.sb.hook.slot.cam;
  const big = !!slot && Math.abs(slot[1].s / slot[0].s - 1) > 0.15;
  const settle = big ? 1 : lerp(0.93, 1, prog(frame, 0, 16, OUT));
  const push = 1 + 0.06 * clamp01((frame - 16) / Math.max(1, r.H - 16));
  return settle * push;
};

/** Slot camera of the hook at frame f (storyboard pair + hookScaleMul), for a stage centred at (cx, cy). */
const hookCam = (r: Resolved, f: number, cx: number, cy: number): NumCam => {
  const slot = r.sb.hook.slot.cam;
  if (!slot) return numCam(r.camKeys[0].to, cx, cy); // panes: the stage itself is not shown in the hook
  const t = slotEase(r)(clamp01(f / r.H));
  const c = lerpCam(numCam(slot[0], cx, cy), numCam(slot[1], cx, cy), t);
  const top = Math.max(S_MAX, slot[0].s, slot[1].s);
  return { ...c, s: Math.min(c.s * hookScaleMul(r, Math.min(f, r.H)), top) };
};

/** Camera of the stage at `frame` (before the punch), as slide centre + scale, for a stage centred at
 *  (540, stage.cy). */
const baseCamAt = (r: Resolved, frame: number): NumCam => {
  const st = refStageAt(r, frame);
  const keys = r.camKeys;
  let i = -1;
  for (let k = 0; k < keys.length; k++) if (keys[k].f <= frame) i = k;
  if (i < 0) return hookCam(r, frame, st.cx, st.cy);
  const k = keys[i];
  const settle = k.f + k.dur;
  if (frame < settle) {
    // value the previous segment had on the keyframe's own frame (includes that segment's drift)
    const from = k.f === 0 ? numCam(k.to, st.cx, st.cy) : prevValue(r, i, k.f);
    return lerpCam(from, numCam(k.to, st.cx, st.cy), EASES[k.ease]((frame - k.f) / k.dur));
  }
  let s = k.to.s * driftMul(r, k.f, frame - settle);
  if (frame > r.T + 48) s *= 1 + HOLD_PUSH * clamp01((frame - (r.T + 48)) / 54);
  s = Math.min(s, Math.max(S_MAX, k.to.s));
  return numCam(k.to, st.cx, st.cy, s);
};
const prevValue = (r: Resolved, i: number, f: number): NumCam => {
  // evaluate the track as if key i did not exist, at frame f
  const keys = r.camKeys;
  const st = refStageAt(r, f);
  if (i === 0) return hookCam(r, f, st.cx, st.cy);
  const k = keys[i - 1];
  const settle = k.f + k.dur;
  if (f < settle) return lerpCam(prevValue(r, i - 1, k.f), numCam(k.to, st.cx, st.cy), EASES[k.ease]((f - k.f) / k.dur));
  const s = Math.min(k.to.s * driftMul(r, k.f, f - settle), Math.max(S_MAX, k.to.s));
  return numCam(k.to, st.cx, st.cy, s);
};

/** Camera punch factor (s x 1.045, or the punch's own `amp`: 6 f in OUT, 20 f back INOUT). */
export const punchAt = (r: Resolved, frame: number): number => {
  let m = 1;
  for (const p of r.punches) {
    const d = frame - p.f;
    if (d < 0 || d > 26) continue;
    const a = d <= 6 ? OUT(d / 6) : 1 - INOUT((d - 6) / 20);
    m = Math.max(m, 1 + (p.amp ?? 0.045) * a);
  }
  return m;
};

/** The stage view (rect + camera) at `frame`.
 *  LOOKS: the camera is evaluated in the REFERENCE stage (so every storyboard key, pin and slot camera means what
 *  it meant in the approved layout) and then TRANSPLANTED into the look's stage box: the slide point that sits at
 *  the centre of the reference box sits at the centre of the look's box, and the scale is multiplied by
 *  (look box width / 1000). A box of another aspect simply shows more or less of the slide above and below. */
export const stageViewAt = (r: Resolved, frame: number): View => {
  const st = stageAt(r, frame);
  const c = baseCamAt(r, frame);
  const p = punchAt(r, frame);
  const k = st.w / REF_W;
  return makeView({ cx: c.cx, cy: c.cy, s: Math.min(c.s * p, Math.max(S_MAX, c.s)) * k }, toScreenRect(st));
};

// ---- full-bleed scrims ("tela-cheia") -----------------------------------------------------------------------------
export interface Scrims {
  /** graphite alpha of the plateaus */
  alpha: number;
  /** top scrim: `alpha` from y 0 to `top0`, 0 at `top1` */
  top0: number; top1: number;
  /** bottom scrim: 0 at `b0`, `alpha` at `b1`, solid graphite from `b2` down */
  b0: number; b1: number; b2: number;
}
/** Scrims of a full-bleed look at `frame` (null for every other look). `headTop` / `headBottom` = cap-top of the
 *  first and baseline of the last hook headline line. Same clocks as the stage edges. */
export const scrimsAt = (r: Resolved, frame: number, headTop: number, headBottom: number): Scrims | null => {
  const b = r.look.layout.bleed;
  if (!b) return null;
  const hook = { top: b.hookTop, b0: headTop - b.hookLead, b1: headTop - 24, b2: Math.max(b.hookSolid, headBottom + 20) };
  // the body scrim reaches `alpha` three quarters of the way down its fade
  const mid = (z: [number, number]) => z[0] + (z[1] - z[0]) * 0.75;
  const body = { top: b.bodyTop, b0: b.bodyBottom[0], b1: mid(b.bodyBottom), b2: b.bodyBottom[1] };
  const close = { top: b.closeTop, b0: b.bodyBottom[0], b1: mid(b.bodyBottom), b2: b.bodyBottom[1] };
  const end = { top: b.closeTop, b0: b.endBottom[0], b1: mid(b.endBottom), b2: b.endBottom[1] };
  const mix = (p: typeof hook, q: typeof hook, t: number) =>
    ({ top: lerp(p.top, q.top, t), b0: lerp(p.b0, q.b0, t), b1: lerp(p.b1, q.b1, t), b2: lerp(p.b2, q.b2, t) });
  let v = frame < r.P ? mix(hook, body, prog(frame, r.H, EDGE_DUR, OUT)) : mix(body, close, prog(frame, r.P, EDGE_DUR, INOUT));
  v = mix(v, frame < r.P ? v : end, prog(frame, r.T + 10, EDGE_DUR, INOUT));
  return { alpha: b.alpha, top0: v.top, top1: v.top + b.topFade, b0: v.b0, b1: v.b1, b2: v.b2 };
};

// ---- hook panes (PaneSplit, SYSTEM 8.3) ---------------------------------------------------------------------------
export const MERGE_DUR = 16;
/** true while the hook is drawn as panes (frame < H + 16 and the storyboard has panes). */
export const panesActive = (r: Resolved, frame: number) => !!r.hook.panes && frame < r.H + MERGE_DUR;

export interface PaneState { view: View; merge: number; films: string[] }
/** Pane i at `frame`: its screen rect and camera. Until H: the pane's own rect and cam[0] -> cam[1] (linear).
 *  H..H+16: rect and mapping interpolate (INOUT) to where the pane's films sit in the first body camera, so the
 *  normal stage can take over on H+16 without a jump. */
export const paneAt = (r: Resolved, i: number, frame: number): PaneState => {
  const pane = (r.hook.panes ?? [])[i];
  const rect0: ScreenRect = { x: pane.rect[0], y: pane.rect[1], w: pane.rect[2], h: pane.rect[3] };
  const t0 = clamp01(frame / r.H);
  // hook life: settle + slow push + the accent punch, about the pane's pin (see hookScaleMul)
  const s0 = Math.min(
    lerp(pane.cam[0].s, pane.cam[1].s, t0) * hookScaleMul(r, Math.min(frame, r.H)) * (frame < r.H ? punchAt(r, frame) : 1),
    Math.max(S_MAX, pane.cam[0].s, pane.cam[1].s),
  );
  const cx0 = rect0.x + rect0.w / 2;
  const cy0 = rect0.y + rect0.h / 2;
  const a = lerpCam(numCam(pane.cam[0], cx0, cy0, s0), numCam(pane.cam[1], cx0, cy0, s0), t0);
  const v0 = makeView({ ...a, s: s0 }, rect0);
  const m = prog(frame, r.H, MERGE_DUR, INOUT);
  if (m <= 0) return { view: v0, merge: 0, films: pane.films };
  // target: the first body camera on the BODY stage
  const target = viewFromCam(r.camKeys[0].to, { x: STAGE_BODY.left, y: STAGE_BODY.top, w: STAGE_BODY.w, h: STAGE_BODY.h });
  const rects: Rect[] = r.sb.films.filter((f) => pane.films.includes(f.id)).map((f) => f.rect);
  const tr = rectToScreen(target, rectUnion(rects));
  const rect: ScreenRect = {
    x: lerp(rect0.x, tr.x, m), y: lerp(rect0.y, tr.y, m), w: lerp(rect0.w, tr.w, m), h: lerp(rect0.h, tr.h, m),
  };
  const s = lerp(v0.s, target.s, m);
  const ox = lerp(v0.ox, target.ox, m);
  const oy = lerp(v0.oy, target.oy, m);
  return {
    view: { rect, s, ox, oy, cx: (rect.x + rect.w / 2 - ox) / s, cy: (rect.y + rect.h / 2 - oy) / s },
    merge: m, films: pane.films,
  };
};

/** Stage tilt (c4): rotateX 8deg -> 0, translateY 30 -> 0, scale 0.96 -> 1 over 16 f OUT. Returns a CSS
 *  transform or undefined. */
export const tiltAt = (r: Resolved, frame: number): string | undefined => {
  for (const f of r.tilts) {
    const d = frame - f;
    if (d < 0 || d >= 16) continue;
    const k = 1 - OUT(d / 16);
    return `perspective(1200px) translateY(${30 * k}px) rotateX(${8 * k}deg) scale(${1 - 0.04 * k})`;
  }
  return undefined;
};

