// Storyboard schema (SYSTEM.md section 12) as TypeScript. ENGINE-OWNED.
// Fields marked [ext] are engine extensions that SYSTEM 12 does not list; they are all optional.
// All coordinates are SLIDE space (x 0..1367, y 0..912) unless marked "screen".

import type { LookOverride } from "./look";

/** Word anchor: n-th (1-based) entry of palavras whose `w` equals `w` exactly; frame = round(s*30) + off.
 *  `f` is the EXPECTED frame from the storyboard; resolution throws when |resolved - f| > 1.
 *  `{ f }` alone = absolute frame (joins, closing). */
export type Anchor = { w: string; n: number; off?: number; f: number } | { f: number };
export type Pt = [number, number];
/** x0, y0, x1, y1 */
export type Rect = [number, number, number, number];
/** Camera: slide point (cx,cy) at the stage centre, or slide point `pin` held at screen point `at`. s = screen px per slide px (<= 2.0). */
export type Cam = { cx: number; cy: number; s: number } | { pin: Pt; at: Pt; s: number };
export type Until = Anchor | "closing" | "end";
export type DockName = "TL" | "TR" | "BL" | "BL2" | "BR";
export type Dock = DockName | { x: number; y: number };
export type CueName = "tick" | "pop" | "whoosh";

export interface Film { id: string; rect: Rect; from?: number; to?: number }
export interface CoverSpec {
  /** [ext] id used for closing.keep as `<id>-label` (default "cover" + A, B, ... by index). */
  id?: string;
  rect: Rect; label: string; at: Anchor; shakes?: Anchor[];
  /** [ext] dot pulses on the label chip. */
  pulses?: Anchor[];
}
export interface PatchSpec { rect: Rect; fill: "stage" | "filmBlack" }
export interface WordSync {
  anchor: Anchor; line: number; word: number;
  /** [ext] true = the word only punches on this frame (it does not set the word's entry frame). */
  punch?: boolean;
}
export interface PaneSpec {
  /** screen x, y, w, h */
  rect: Rect; films: string[]; cam: [Cam, Cam];
}
export interface HookSpec {
  kicker: string; lines: string[]; accent: string; quoted: boolean; size: number;
  wordSync?: WordSync[];
  accentAt: Anchor;
  /** token absent before this anchor (c2). */
  tokenFrom?: Anchor;
  tokenMove?: string;
  /** [ext] c2: from `tokenFrom` until H the token is NOT in the kicker row but parked after the end of headline
   *  line `line` (box `size` px, default 132; left edge `gap` px after the measured end of the line, default 32;
   *  vertically centred on the capitals). At H it flies to the 48 px HUD token (14 f). The kicker stays at x 60
   *  during the hook. */
  tokenHome?: { line: number; gap?: number; size?: number };
  /** [ext] false = no automatic hook motion (settle + push-in of the slot camera, camera punch on the accent
   *  sweep, filler ScanLine when the second half of the hook has no beat). Default true. */
  autoMotion?: boolean;
  /** [ext, looks] text of the series badge at the start of the kicker row (default "CASO 0N", N = the digits of
   *  the storyboard id). Only drawn when the look's layout has `badge: true`. */
  badge?: string;
  /** [ext, looks] a row of pills beside the headline question (c5 "CERTO" / "ERRADO": a NEUTRAL question, never the
   *  answer). The first pill is filled, the others outlined; they pop in on `at` (default: on frame 0) 3 f apart,
   *  take turns pulsing and leave with the kicker. Placement in screen px: `right` (right edge of the row,
   *  default 960) or `x` (left edge), `cy` (default: the kicker row, 282), type `size` (default 30). */
  pills?: { labels: string[]; x?: number; right?: number; cy?: number; size?: number; at?: Anchor };
  /** H */
  exit: number;
  slot: {
    cam?: [Cam, Cam];
    /** [ext] interpolation of slot.cam over 0..H (default "linear"; c4 reverse dolly = "out"). */
    ease?: "linear" | "out" | "inout";
    panes?: PaneSpec[];
  };
}
export type Readout =
  | { type: "countdown"; label: string; arm: Anchor; target: Anchor; zeroTag: string; clear?: Anchor }
  | { type: "tally"; label: string; items: Anchor[]; clear?: Anchor };
export interface HudSpec {
  tag: string[]; sub?: { text: string; at: Anchor };
  readouts: Readout[];
  /** [ext] HUD tag pulses (HudTag.pulses of SYSTEM 8.7). */
  pulses?: Anchor[];
}
export interface CameraKey {
  at: Anchor;
  /** target; may be omitted when `punch` is true. */
  to?: Cam;
  dur: number; cut?: boolean; punch?: boolean;
  /** [ext] easing of the move (default "inout"; c3/c4 slow pushes use "linear"). */
  ease?: "inout" | "linear" | "out";
}
export interface Beat<P = Record<string, unknown>> {
  id: string; el: string; at: Anchor; until?: Until; props: P;
  /** [ext] render this beat inside hook pane N (PaneSplit) instead of the stage; only alive while the panes are. */
  pane?: number;
}
export interface CaptionsSpec { hide: [number, number][]; accent: Anchor[]; emphasis: Anchor[] }
export interface ClosingSpec {
  variant: "A" | "B";
  /** P (variant A) */
  preRoll?: number;
  lines: string[]; accent: string; size: number; quoted?: boolean;
  wordSync?: WordSync[];
  swapTo?: { lines: string[]; accent: string; size: number; quoted?: boolean };
  slotCam: Cam;
  /** beat ids kept after T (cover labels: `<coverId>-label`). */
  keep: string[];
  propMove: string; faceStill?: number;
}
/** same shape as MoveSpec (propKit): { at, name, dur?, args? } */
export interface TokenMove { at: Anchor; name: string; dur?: number; args?: Record<string, unknown> }

export interface Storyboard {
  /** "c1".."c6" for the cuts; any string for test benches ("lab-a"). Composition id = "rp-" + id. */
  id: string;
  format: "primary" | "alt";
  /** "c1/video.mp4" (staticFile). The proxies slide.mp4, cam.mp4 and audio.wav are read from the same folder. */
  video: string;
  /** "c1.json" (src/data) -> palavras, segmentos, frames. Its stem ("c1") is the cut id (face.json key). */
  data: string;
  /** "cursor-c1.json" (src/data) */
  cursor: string;
  /** speech length T (must equal data.frames) */
  frames: number;
  closingFrames: 102;
  freezeStageAt?: number;
  films: Film[];
  covers?: CoverSpec[];
  patches?: PatchSpec[];
  face: {
    still: number;
    /** [ext] extra face-lost intervals [a, b, still?] (frames), on top of face.json's `lost`; `still` = the frame
     *  of the bubble still for THIS interval (default: face.still). c2: the webcam tile shows another
     *  participant's placeholder on f 432-442. Read by FaceBubble only. */
    lost?: ([number, number] | [number, number, number])[];
  };
  /** CoinProp | BombomProp | TracheaPush | LaudoSheet | RibArc | SkinFold (selects the module in src/aula/cuts). */
  prop: { component: string };
  hook: HookSpec;
  hud: HudSpec;
  camera: CameraKey[];
  beats: Beat[];
  captions: CaptionsSpec;
  closing: ClosingSpec;
  /** [ext] extra moves of the kicker/HUD token (hook.tokenMove and closing.propMove are added automatically). */
  tokenMoves?: TokenMove[];
  /** [ext] stage-level effects (c4 "Stage tilt"). */
  stageFx?: { type: "tilt"; at: Anchor }[];
  /** [ext] false = no automatic body camera punches on captions.accent / emphasis words and countdown zeros
   *  (storyboard `punch` keys are not affected). Default true. */
  autoPunch?: boolean;
  /** [ext] extra sound cues requested by the storyboard (subject to the one-cue-per-20-frames rule). */
  sounds?: { at: Anchor; cue: CueName; gainDb?: number }[];
  /** [ext, looks] per-look overrides: `looks["<look id>"]` is deep-merged over this storyboard when that look
   *  renders (look.ts `applyLook`: objects merge, arrays replace; plus `look`, `patchBeats`, `addBeats`). The
   *  default look never reads it. */
  looks?: Record<string, LookOverride>;
}

// ---- data files -------------------------------------------------------------------------------------------------
/** `s` = AUDIBLE start in seconds. For words whose transcribed start sits in silence (first word after a pause)
 *  data.ts replaces it by the measured onset (src/data/onsets.json, scripts/onsets.py) and keeps the
 *  transcription's value in `s0`. Storyboard anchors are CHECKED against s0 and RESOLVE to s. */
export interface Palavra { w: string; s: number; e: number; seg: number; s0?: number }
export interface Segmento { i: number; src_start: number; src_end: number; out_start: number; out_dur: number }
export interface CutData {
  id: string; fps: number; duracao: number; frames: number;
  segmentos: Segmento[]; palavras: Palavra[]; texto?: string;
}
export interface CursorData { id: string; visible: [number, number][]; frames: ([number, number] | null)[] }
export interface FaceData {
  r: number; cy: number; keys: [number, number][]; lost: [number, number][];
  /** [engine] head track (src/data/face-track.json, scripts/face_track.py): [frame, cx, cy] every `step` frames,
   *  tile-local px, already clamped to the tile. When present the bubble crop follows it (x AND y) instead of
   *  `keys` + the fixed `cy`. */
  track?: { step: number; pts: [number, number][] };
}
