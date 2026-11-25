// ALT storyboard schema (spec/ALT.md 5-9). OWNER: ALT author. Files: src/storyboards/c4.alt.json, c6.alt.json.
// The ALT vocabulary is tiny on purpose: Lightbox (always), relay flicker (always), kicker, headline, end question,
// phrase captions, and four beat elements: BorderLabel, MarkerTrace, Lupa, Rehang.
import type { Anchor, Film, Pt, Rect } from "../types";

export type AltEase = "inout" | "out" | "linear";
export interface AltCam { cx: number; cy: number; s: number }
export type AltUntil = Anchor | "closing" | "end";

export interface BorderLabelProps {
  /** first text (lower case, as spoken) */
  text: string;
  /** part of `text` drawn in accent (e.g. "?") */
  accent?: string;
  rolls?: { at: Anchor; text: string; accent?: string }[];
  /** glyph badge drawn after the text of the state that is active on `at`. A state may hold several glyphs: the
   *  later one REPLACES the earlier one with a flip (c4: check -> "?" on "isso"). Removed by the next roll. */
  glyph?: { at: Anchor; kind: "check" | "question" }[];
}
export interface MarkerTraceProps {
  /** [f0, f1] frames of the cursor track drawn LIVE as a marker line */
  cursor: [number, number];
  /** stroke 7 -> 11 -> 7, 10 f */
  pulses?: Anchor[];
  /** false = no pointer dot after f1 (default true) */
  pointerDot?: boolean;
}
export interface LupaProps {
  /** lens diameter in screen px */
  d: number;
  /** magnification of the search phase (camera s x lens <= 2.0) */
  lens: number;
  /** scripted search path (slide space, absolute frames) */
  path: { f: number; pt: Pt }[];
  /** parking: reaches `pt` on frame `f`, shrinking to diameter `d` with lens 1 (rim only) */
  park: { f: number; pt: Pt; d: number };
  /** second phase: the lens rides the doctor's pointer */
  follow?: { cursor: [number, number]; lens: number; d: number };
  /** the rim turns accent (8 f) */
  rimAccentAt?: Anchor;
}
export interface RehangProps {
  /** px the film drops (translateY -dy -> 0) */
  dy?: number;
  /** degrees (rotate -deg -> 0) */
  deg?: number;
}
/** Light sweep over the film (review round 1: the hook and the body needed neutral events): a 3 px accent line
 *  with a soft lightbox-coloured tail travels down (or up) the window once. It asserts nothing about the image. */
export interface ScanProps {
  /** frames of the sweep (default 30) */
  dur?: number;
  dir?: "down" | "up";
}

export type AltBeat =
  | { id: string; el: "BorderLabel"; at: Anchor; until?: AltUntil; props: BorderLabelProps }
  | { id: string; el: "MarkerTrace"; at: Anchor; until?: AltUntil; props: MarkerTraceProps }
  | { id: string; el: "Lupa"; at: Anchor; until?: AltUntil; props: LupaProps }
  | { id: string; el: "Rehang"; at: Anchor; until?: AltUntil; props: RehangProps }
  | { id: string; el: "Scan"; at: Anchor; until?: AltUntil; props: ScanProps };

export interface AltWordSync { anchor: Anchor; line: number; word: number }

export interface AltStoryboard {
  id: string;
  format: "alt";
  video: string;
  /** "c4.json" (src/data) */
  data: string;
  /** "cursor-c4.json" (src/data) */
  cursor: string;
  frames: number;
  closingFrames: 102;
  films: Film[];
  /** slide-space rects that must never be painted (c6: slide text, baby photo). Resolution throws when a film
   *  rect touches one of them. */
  forbid?: Rect[];
  face: { still: number };
  /** lit panel fill opacity (ALT.md 10: 1, or 0.85 when the border glares on a phone) */
  panelFill?: number;
  cams: Record<string, AltCam>;
  hook: {
    lines: string[]; accent: string; quoted: boolean; size: number;
    /** H */
    exit: number;
    /** name of the hook band camera */
    cam: string;
    /** scale factor reached at H (default 1.10; 1.04 was not perceptible) */
    push?: number;
    /** optional second band camera: the hook camera travels cam -> camTo over 0..H (a slow pan down the film) */
    camTo?: string;
    /** frame on which the accent words sweep from white to accent (+ a x 1.05 camera punch); default 30 % of H */
    accentAt?: Anchor;
  };
  /** kicker parts, each fading in on its anchor (c4 case file; c6 "PITFALLS") */
  kicker: { at: Anchor; text: string }[];
  /** body camera moves; the first one must be at H (panel opening). At most 6 between H and P (was 3: the review
   *  found the body static for 10-12 s). After a move settles the camera breathes (timeline.ts). */
  camera: { at: Anchor; to: string; dur: number; ease?: AltEase }[];
  punches?: { at: Anchor; amount: number }[];
  beats: AltBeat[];
  captions: { hide: [number, number][]; keywords: Anchor[] };
  closing: {
    /** P */
    preRoll: number;
    lines: string[]; accent: string; size: number; quoted?: boolean;
    wordSync: AltWordSync[];
    /** name of the closing band camera */
    cam: string;
    /** ids of the beats that stay lit on the dark film after T (the open spot) */
    keep: string[];
    /** footage frame shown by the camera block after T (default T - 1); pick one with his eyes up */
    faceStill?: number;
  };
  /** c4: no check glyph may be visible after this frame (must-not-reveal rule); resolution throws otherwise */
  noCheckAfter?: number;
}
