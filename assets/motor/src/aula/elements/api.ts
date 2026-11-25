// THE import surface for element / cut / ALT authors:  import { defineElement, Txt, C, ... } from "../api";
// ENGINE-OWNED (do not edit; ask for additions in your report instead).
import type { ElCtx, ElementDef } from "./types";
import type { Anchor } from "../types";

export type { CueRequest, DockPos, ElCtx, ElementDef } from "./types";
export type {
  Anchor, Beat, Cam, CueName, Dock, DockName, Film, Palavra, Pt, Rect, Storyboard, Until,
} from "../types";
export type { CutModule, PropComponent, PropMove, PropPlacement, PropProps } from "../propTypes";
export type { Resolved, ResolvedBeat, StageRect } from "../resolve";
export type { CursorApi } from "../cursor";
export type { NumCam, ScreenRect, View } from "../camera";

export * from "../tokens";
export { inkAt } from "../look";
export type { AccentWord, Ink, Look } from "../look";
export { capHeight, capOffset, fitSize, METRICS, Txt, textWidth } from "../fonts";
export type { TextStyle, TxtProps, Weight } from "../fonts";
export { catmullRomPath, pointAlong, polylineLength, rectCenter, rectUnion, roundRectPath } from "../geom";
export { lerpCam, makeView, numCam, rectToScreen, toScreen, toSlide, viewCss, viewFromCam, viewSvg } from "../camera";
export { FilmView, filmClipPath } from "../components/FilmView";
export { activeMove, moveSpecs, PropSvg } from "../propKit";
export type { MoveSpec } from "../propKit";
export { EXIT_FRAMES } from "./context";

/** Identity helper that fixes the props type of an element:  export const Ring = defineElement<RingProps>({ ... }) */
export const defineElement = <P>(def: ElementDef<P>): ElementDef<P> => def;

/** Resolves a list of anchors of the beat's props to frames (with the +-1 frame assertion). */
export const frames = (ctx: { fr(a: Anchor): number }, anchors?: Anchor[]): number[] => (anchors ?? []).map((a) => ctx.fr(a));
export type { ElCtx as Ctx };
