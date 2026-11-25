// ELEMENT PLUG-IN CONTRACT. ENGINE-OWNED: element authors import from here, they do not edit it.
// An element is a plain object (ElementDef) with up to three render layers. The engine mounts it for every beat
// whose `el` names it, from `at - lead` to `until + 6` (the 6-frame exit), and hands every layer the same ctx.
import type React from "react";
import type { View, ScreenRect } from "../camera";
import type { CursorApi } from "../cursor";
import type { Look } from "../look";
import type { PropComponent } from "../propTypes";
import type { Resolved, ResolvedBeat, StageRect } from "../resolve";
import type { EASE, TOKENS } from "../tokens";
import type { Anchor, CueName, Dock, Palavra, Pt, Rect, Storyboard } from "../types";

export interface DockPos {
  /** screen x of the item's LEFT edge (align "left") or RIGHT edge (align "right") */
  x: number;
  /** screen y of the item's TOP edge (chips, h = tokens.CHIP_H = 64) */
  y: number;
  align: "left" | "right";
  /** for cards docked at the bottom (BR): the card's BOTTOM edge = stageBottom - 16 */
  bottom: number;
}

export interface ElCtx<P = Record<string, unknown>> {
  /** current composition frame (0 .. frames + 101) */
  frame: number;
  fps: 30;
  /** frame of the FOOTAGE the stage shows now: min(frame, freezeStageAt, T - 1). Use it (not `frame`) to read
   *  the cursor for anything that must stay glued to the picture (CursorHalo, live Trace, Compare's FilmView) */
  videoFrame: number;
  /** media folder in public/ ("c1"): <FilmView dir={ctx.dir} films={ctx.sb.films} .../> */
  dir: string;
  /** the resolved beat; `props` is beat.props typed */
  beat: ResolvedBeat<P>;
  props: P;
  /** resolved start frame of the beat */
  at: number;
  /** resolved exit frame: an absolute frame, the closing pre-roll P ("closing"), T (un-kept "end") or a frame
   *  beyond the composition (kept beats) */
  until: number;
  /** frame - at (negative during `lead`) */
  age: number;
  /** 0 while alive, 0 -> 1 linearly over the 6 frames after `until` */
  exit: number;
  /** 1 - exit. The engine already applies it to the layer wrappers unless the def sets `ownExit` */
  opacity: number;
  closing: {
    variant: "A" | "B";
    /** pre-roll start (variant A: closing.preRoll; variant B: T) */
    P: number;
    /** first frame after the speech (= frames) */
    T: number;
    /** frame - T (negative during the speech) */
    C: number;
    /** frame >= P */
    active: boolean;
    /** this beat's id is in closing.keep (it survives after T and should keep breathing) */
    kept: boolean;
    /** film dim progress 0..1 (C 0..12): the film is at brightness 1 - filmDim * dim */
    dim: number;
    /** tokens.FILM_DIM (0.3): how much brightness the film loses in the closing */
    filmDim: number;
  };
  /** CURRENT rect of the view this beat is drawn in (the stage, or its hook pane), screen px; it moves when the
   *  stage edges animate */
  stage: StageRect;
  /** current camera of that view */
  view: View;
  cam: { cx: number; cy: number; s: number };
  /** slide point -> screen px (canvas coordinates) and back */
  toScreen(p: Pt): Pt;
  toSlide(p: Pt): Pt;
  rectToScreen(r: Rect): ScreenRect;
  /** n screen px expressed in slide units at the current scale (stroke widths, arm lengths in the Slide layer) */
  px(n: number): number;
  /** dock position (SYSTEM 2) relative to the current stage rect */
  dock(d: Dock): DockPos;
  /** the doctor's pointer */
  cursor: CursorApi;
  palavras: Palavra[];
  /** anchor -> frame, with the +-1 frame assertion */
  fr(a: Anchor): number;
  /** join frames of the footage (SYSTEM 3.3) */
  joins: number[];
  tokens: typeof TOKENS;
  /** [looks] the look that renders (theme + layout). Inside the stage keep using `C` / `dim()` (they are live and
   *  already follow `look.film`); for anything that must match the PAGE use `inkAt(ctx.look, y)` from ../api */
  look: Look;
  ease: typeof EASE;
  /** the cut's Prop component (storyboard prop.component) */
  Prop: PropComponent;
  /** index of the hook pane this beat is drawn in, or null for the stage */
  pane: number | null;
  sb: Storyboard;
  /** everything the engine resolved (all beats with their frames: use it to find siblings, e.g. row docks) */
  r: Resolved;
}

export interface CueRequest {
  /** absolute frame */
  f: number;
  cue: CueName;
  /** extra gain in dB on top of the cue's own level (<= 0; JoinBlink uses -6) */
  gainDb?: number;
}

export interface ElementDef<P = Record<string, unknown>> {
  /** SCREEN-space HTML, inside the stage clip, BELOW the slide-space marks (rare: a second film layer). */
  Under?: React.FC<{ ctx: ElCtx<P> }>;
  /** SLIDE-space SVG: return SVG nodes. They are placed inside `<g transform=camera>` of a canvas-sized <svg>,
   *  so coordinates are slide px and move with the camera. Sizes that must stay constant on screen use
   *  ctx.px(n) (recommended) or vector-effect="non-scaling-stroke". */
  Slide?: React.FC<{ ctx: ElCtx<P> }>;
  /** SCREEN-space HTML, inside the stage clip, above the marks. Children are positioned absolutely in CANVAS
   *  px (0..1080, 0..1920); use ctx.toScreen / ctx.dock. */
  Screen?: React.FC<{ ctx: ElCtx<P> }>;
  /** SCREEN-space HTML, inside the stage clip, above the Screen layers of ALL beats (ScanLine, Spotlight). */
  Over?: React.FC<{ ctx: ElCtx<P> }>;
  /** `until` used when the beat gives none. Default "closing". A function returns an absolute frame. */
  defaultUntil?: "closing" | "end" | ((beat: { at: number; props: P }, r: { T: number; P: number }) => number);
  /** frames before `at` during which the element is already mounted (default 0) */
  lead?: number;
  /** true = the element animates its own exit with ctx.exit; the engine then does not fade the wrappers */
  ownExit?: boolean;
  /** sound cues this beat wants (pure function of the resolved beat; called once per cut). The engine merges all
   *  requests and enforces "one cue per 20 frames". */
  cues?: (beat: ResolvedBeat<P>, r: Resolved) => CueRequest[];
}
