// Small helpers for Prop components and for the elements that host them (PropCard, Prop). ENGINE-OWNED.
import React from "react";
import type { PropMove } from "./propTypes";
import { C } from "./tokens";
import type { Anchor } from "./types";

/** A prop move as written in a storyboard (beat props of PropCard / Prop, or storyboard.tokenMoves[]). */
export interface MoveSpec { at: Anchor; name: string; dur?: number; args?: Record<string, unknown> }

/** Storyboard move specs -> PropMove[] (frames resolved with ctx.fr), sorted by frame. */
export const moveSpecs = (specs: MoveSpec[] | undefined, fr: (a: Anchor) => number): PropMove[] =>
  (specs ?? []).map((m) => ({ name: m.name, at: fr(m.at), dur: m.dur, args: m.args })).sort((a, b) => a.at - b.at);

/** The latest move that has started (optionally only among `names`), with t = frames since it started. */
export const activeMove = (moves: PropMove[], frame: number, names?: string[]): { move: PropMove; t: number } | null => {
  let hit: PropMove | null = null;
  for (const m of moves) {
    if (m.at <= frame && (!names || names.includes(m.name)) && (!hit || m.at >= hit.at)) hit = m;
  }
  return hit ? { move: hit, t: frame - hit.at } : null;
};

/** Square SVG of `size` px with a 0..1 viewBox, round caps, no fill, white stroke. Because the viewBox is 1 unit
 *  wide, stroke widths are given through `sw(px)` = px / size (2 px strokes: strokeWidth={sw(2)}). */
export const PropSvg: React.FC<{
  size: number; style?: React.CSSProperties;
  children: (sw: (px: number) => number) => React.ReactNode;
}> = ({ size, style, children }) => (
  <svg width={size} height={size} viewBox="0 0 1 1" fill="none" stroke={C.white} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "block", overflow: "visible", ...style }}>
    {children((px) => px / Math.max(1, size))}
  </svg>
);
