// The Prop interface (SYSTEM 8.22): the ONE custom component of each cut. ENGINE-OWNED.
// A Prop draws itself inside a square box of `size` px (2 px white strokes, one accent detail, transparent fill).
// It never positions itself: the HOST places the box and plays the entrance (POP scale 0 -> 1, 8 f):
//   - token : the engine (kicker row 84 px <-> HUD 48 px),
//   - card  : the PropCard element,
//   - film  : the Prop element (screen space over the stage, >= 130 px; it also performs "fly").
import type React from "react";
import type { ElementDef } from "./elements/types";

export type PropPlacement = "token" | "card" | "film";

/** A named move triggered at a frame. The Prop decides what each name means (table of SYSTEM 8.22) and its
 *  default duration; unknown names must be ignored. */
export interface PropMove {
  name: string;
  /** composition frame the move starts on (already resolved from its anchor) */
  at: number;
  /** optional duration override in frames */
  dur?: number;
  /** free-form arguments (e.g. { turns: 540 } for the coin flip, { segment: [[x,y],[x,y]] } for the push) */
  args?: Record<string, unknown>;
}

export interface PropProps {
  /** side of the square box in px (the token passes 84..48 while it resizes; draw in a 0..1 viewBox) */
  size: number;
  placement: PropPlacement;
  /** current composition frame */
  frame: number;
  /** every move of THIS instance, sorted by `at`; play those with at <= frame (later moves override earlier) */
  moves: PropMove[];
  /** frame this instance appeared on (for self-drawing intros such as "stroke draws in 8 f"); undefined = it is
   *  there from frame 0 */
  appear?: number;
  /** stroke colours (defaults: white / accent) */
  color?: string;
  accent?: string;
}
export type PropComponent = React.FC<PropProps>;

/** What src/aula/cuts/<id>.tsx must export. */
export interface CutModule {
  Prop: PropComponent;
  /** cut-specific extra elements (el name -> implementation); looked up after the shared registry */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: Record<string, ElementDef<any>>;
}
