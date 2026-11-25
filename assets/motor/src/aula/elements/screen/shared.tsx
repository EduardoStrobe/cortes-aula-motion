// Helpers shared by the screen-group elements (Chip, CountTick, EquationBar, PropCard, Prop, AnswerField).
// OWNER: screen-group element author.
import React from "react";
import { C, CHIP_H, clamp01, dim, INOUT, lerp, prog, type Anchor, type Dock, type ElCtx } from "../api";

/** Top-left corner of a w x h box docked on the CURRENT stage rect (SYSTEM 2):
 *  TL / TR: top = stageTop + 16.  BL / BR: bottom = stageBottom - 16 (a 56 px chip lands on stageBottom - 72).
 *  BL2: bottom aligned with a BL2 chip (stageBottom - 80).  {x, y}: explicit left / top.
 *  Right docks (TR, BR) give the box's RIGHT edge (940). */
export const dockBox = (ctx: Pick<ElCtx, "dock">, dock: Dock, w: number, h: number): { left: number; top: number; align: "left" | "right" } => {
  const d = ctx.dock(dock);
  const left = d.align === "right" ? d.x - w : d.x;
  if (typeof dock === "object") return { left, top: d.y, align: d.align };
  if (dock === "TL" || dock === "TR") return { left, top: d.y, align: d.align };
  if (dock === "BL2") return { left, top: d.y + CHIP_H - h, align: d.align };
  return { left, top: d.bottom - h, align: d.align };
};

/** HERO ENTRANCE (review + client: "quando ele falar de moeda, traga animação pra prender a atenção"; the props
 *  were 100-180 px hairline drawings in a corner). A prop / prop card first appears BIG in the middle of the
 *  stage, over a dimmed film, on its spoken word, plays the start of its first move there, and then flies to the
 *  place and size the storyboard gives it:
 *    at .. at + hold (20 f)        centred on the stage, scaled so its longer side is about `maxSide` px (strokes
 *                                  scale with it: 2 px -> 4-5 px), stage dimmed to dim(0.6) (in over 4 f)
 *    + fly (14 f, INOUT)           travels and shrinks to its own box; the dim lifts with it
 *  It only runs in the body (not in the hook slot, a hook pane, or when it would run into the closing), and a
 *  beat opts out with `"hero": false`. Returns the transform to add to the box and the dim level.
 *  Cut-specific cards (cuts/c<N>.tsx) can use the same helper + <HeroDim>. */
export const HERO = { hold: 20, fly: 14, dim: 0.6, maxSide: 430 };
export const heroEntrance = (
  ctx: Pick<ElCtx, "frame" | "at" | "stage" | "r" | "pane">,
  box: { left: number; top: number; w: number; h: number },
  enabled = true,
): { dx: number; dy: number; scale: number; dim: number; k: number } => {
  const off = { dx: 0, dy: 0, scale: 1, dim: 0, k: 1 };
  if (!enabled || ctx.pane !== null || ctx.at < ctx.r.H + 16 || ctx.at + HERO.hold + HERO.fly > ctx.r.P) return off;
  const k = prog(ctx.frame, ctx.at + HERO.hold, HERO.fly, INOUT);
  if (k >= 1) return off;
  const st = ctx.stage;
  const s0 = Math.max(1, Math.min(HERO.maxSide / Math.max(box.w, box.h), (st.h - 60) / box.h, (st.w - 60) / box.w));
  const cx = box.left + box.w / 2;
  const cy = box.top + box.h / 2;
  return {
    dx: (st.cx - cx) * (1 - k), dy: (st.cy - cy) * (1 - k), scale: lerp(s0, 1, k),
    dim: HERO.dim * (1 - k) * clamp01((ctx.frame - ctx.at + 1) / 4), k,
  };
};
/** The stage-wide dim behind a hero entrance (draw it BEFORE the box, in the same Screen layer). */
export const HeroDim: React.FC<{ ctx: Pick<ElCtx, "stage">; level: number }> = ({ ctx, level }) => (level > 0 ? (
  <div style={{
    position: "absolute", left: ctx.stage.left, top: ctx.stage.top, width: ctx.stage.w, height: ctx.stage.h, background: dim(level),
  }} />
) : null);

/** Opacity steps `{ at, opacity }[]` (c2 "fade to 40 %"): the value at `frame`, moving linearly over `dur` frames
 *  from the previous value (1 before the first step). */
export const stepOpacity = (
  steps: { at: Anchor; opacity: number }[] | undefined, fr: (a: Anchor) => number, frame: number, dur = 6,
): number => {
  let v = 1;
  const list = (steps ?? []).map((s) => ({ f: fr(s.at), o: s.opacity })).sort((a, b) => a.f - b.f);
  for (const s of list) {
    if (frame < s.f) break;
    v = v + (s.o - v) * prog(frame, s.f, dur);
  }
  return clamp01(v);
};

/** 1 px inside border of a rounded box (drawn as an overlay so children keep the box's own coordinates). */
export const Border: React.FC<{ radius: number; color?: string; dashed?: boolean }> = ({ radius, color = C.line, dashed }) => (
  <div style={{
    position: "absolute", inset: 0, borderRadius: radius, border: `1px ${dashed ? "dashed" : "solid"} ${color}`,
    boxSizing: "border-box", pointerEvents: "none",
  }} />
);

/** A canvas-sized SVG for screen-space lines (leaders) inside a Screen layer. */
export const CanvasSvg: React.FC<{ opacity?: number; children: React.ReactNode }> = ({ opacity, children }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity }}>
    {children}
  </svg>
);
