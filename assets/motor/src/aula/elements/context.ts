// Builds the ElCtx handed to every element layer. ENGINE-OWNED.
import { rectToScreen, toScreen, toSlide, type View } from "../camera";
import type { Resolved, ResolvedBeat, StageRect } from "../resolve";
import { CHIP_H, clamp01, EASE, FILM_DIM, TOKENS } from "../tokens";
import type { Dock } from "../types";
import type { DockPos, ElCtx } from "./types";

export const EXIT_FRAMES = 6;

/** Dock positions of SYSTEM 2, relative to the CURRENT rect of the view (stage or pane). */
export const dockPos = (stage: StageRect, d: Dock): DockPos => {
  // [looks] a full-bleed stage docks to the reference box it carries (`dock`), not to the frame edges
  const st = stage.dock ?? stage;
  const leftX = st.left + 20;
  const rightX = Math.min(st.right - 20, 940);
  const bottom = st.bottom - 16;
  if (typeof d === "object") return { x: d.x, y: d.y, align: "left", bottom };
  switch (d) {
    case "TL": return { x: leftX, y: st.top + 16, align: "left", bottom };
    case "TR": return { x: rightX, y: st.top + 16, align: "right", bottom };
    // y = top of a CHIP_H (64 px) chip whose bottom is 16 px above the stage's bottom edge; BL2 = the row above it
    case "BL": return { x: leftX, y: bottom - CHIP_H, align: "left", bottom };
    case "BL2": return { x: leftX, y: bottom - 2 * CHIP_H - 8, align: "left", bottom };
    case "BR": return { x: rightX, y: bottom - CHIP_H, align: "right", bottom };
    default: throw new Error(`[aula] unknown dock "${String(d)}"`);
  }
};

export const isAlive = (b: ResolvedBeat, frame: number) => frame >= b.at - b.lead && frame < b.until + EXIT_FRAMES;

export const makeCtx = (r: Resolved, beat: ResolvedBeat, frame: number, view: View, stage: StageRect): ElCtx => {
  const exit = clamp01((frame - beat.until) / EXIT_FRAMES);
  return {
    frame, fps: 30, videoFrame: Math.min(frame, r.sb.freezeStageAt ?? Infinity, r.T - 1), dir: r.dir, beat, props: beat.props, at: beat.at, until: beat.until, age: frame - beat.at,
    exit, opacity: 1 - exit,
    closing: {
      variant: r.variant, P: r.P, T: r.T, C: frame - r.T, active: frame >= r.P, kept: beat.kept,
      dim: clamp01((frame - r.T) / 12), filmDim: FILM_DIM,
    },
    stage, view, cam: { cx: view.cx, cy: view.cy, s: view.s },
    toScreen: (p) => toScreen(view, p),
    toSlide: (p) => toSlide(view, p),
    rectToScreen: (rect) => rectToScreen(view, rect),
    px: (n) => n / view.s,
    dock: (d) => dockPos(stage, d),
    cursor: r.cursor, palavras: r.data.palavras,
    fr: (a) => r.fr(a, `beat "${beat.id}"`),
    joins: r.joins, tokens: TOKENS, look: r.look, ease: EASE, Prop: r.module.Prop, pane: beat.pane, sb: r.sb, r,
  };
};
