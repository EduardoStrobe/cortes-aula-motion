// Aula "Manchete Viva" — design tokens (SYSTEM.md sections 1, 2, 4, 6). ENGINE-OWNED: do not edit from elements/cuts.
import { Easing, spring } from "remotion";

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const CLOSING_FRAMES = 102;
/** Closing timeline after T, in frames C = frame - T (SYSTEM 10.3, re-timed in review so that no text is on screen
 *  while a stage edge still travels through it, and so that the last 2 s are not a frozen card):
 *  C 0-12 film dim | C 7.. end question (variant B slams, one line every 3 f) | C 8 prop callback | C 10-26 stage
 *  bottom edge rises | C 22 / 25 CTA rows | C 31 "aula completa" accent sweep (+ tick) | C 26 / 30 name, lesson |
 *  C 40-50 pill grows | C 51 pill lands (bump + pop) | C 76 pill pulse (+ tick) | C 48-102 hold push x 1.06.
 *  With closing.swapTo (c1) the CTA rows and the sweep are 4 f later (ctaShift). */
export const CLOSING_T = {
  slamB: 7, slamStep: 3, cta1: 22, cta2: 25, sweep: 31, name: 26, lesson: 30, pill: 40, pillText: 46, pillLand: 51,
  pillPulse: 76, logo: 42,
} as const;

/** Colour tokens (SYSTEM 1). No other colour may appear in UI.
 *  LOOKS (ENGINE.md "Looks"): `C` and `dim()` are LIVE. They always answer with the ON-FILM palette of the look that
 *  is being rendered (everything drawn inside the stage: marks, chips, cards, covers). The default palette below is
 *  what every look uses today, so the stage stays a dark viewer on any background; a look may override single
 *  entries (`look.film`). Read them at RENDER time (inside a component / element layer / function): a module-level
 *  `const X = C.accent` would freeze the default. Page colours (anything outside the stage) come from the look's
 *  inks, see look.ts. */
export const C_DEFAULT = {
  graphite: "#1C1E22",
  graphite2: "#1E2228",
  white: "#FFFFFF",
  text2: "rgba(255,255,255,0.72)",
  line: "rgba(255,255,255,0.10)",
  accent: "#60AFF0",
  accent2: "#6F92BF",
  accentGrad: "linear-gradient(135deg, #60AFF0 0%, #6F92BF 100%)",
  cardFill: "rgba(30,34,40,0.92)",
  filmBlack: "#000000",
  bg: "linear-gradient(160deg, #1C1E22 0%, #1E2228 100%)",
} as const;
export type Palette = { [K in keyof typeof C_DEFAULT]: string };
/** Extra entries of the on-film palette that are not colours of `C`: the r,g,b of dim(). */
export type FilmPalette = Partial<Palette> & { dimRgb?: string };
const DIM_RGB = "28,30,34";
let activeC: Palette = C_DEFAULT;
let activeDim = DIM_RGB;
/** ENGINE ONLY (AulaCut): selects the on-film palette for everything rendered from now on. `null` = default. */
export const setFilmPalette = (p: FilmPalette | null): void => {
  if (!p) {
    activeC = C_DEFAULT;
    activeDim = DIM_RGB;
    return;
  }
  const { dimRgb, ...rest } = p;
  activeC = Object.keys(rest).length ? { ...C_DEFAULT, ...rest } : C_DEFAULT;
  activeDim = dimRgb ?? DIM_RGB;
};
export const C: Palette = new Proxy(C_DEFAULT as Palette, {
  get: (_t, k) => (activeC as Record<string | symbol, string>)[k],
});
/** dim(a) = graphite at alpha a (spotlight / closing dims, mark under-strokes). */
export const dim = (a: number) => `rgba(${activeDim},${a})`;
/** "#RRGGBB" at alpha a, as an rgba() string ("#60AFF0", 0.12 -> "rgba(96,175,240,0.12)"). */
export const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};
/** The accent token at alpha a (live: follows the on-film palette). No new hue is introduced. */
export const accentA = (a: number) => hexA(C.accent, a);

export const FONT = "'Manrope'";

/** Stroke weights (SYSTEM 1, "Line weights"), in SCREEN px. Review: the SYSTEM values (mark 3 / under 5 / guide 2)
 *  were sized on a desktop preview and did not register at feed size (a 3 px trace on a 1080 px canvas is 1 px on
 *  a phone); marks are now 5 px over an 8 px under-stroke, guides / brackets 3 px. */
export const STROKE = { ui: 1, mark: 5, markUnder: 8, guide: 3 } as const;
/** Closing film dim: the film goes to brightness 1 - FILM_DIM over C 0..12 (was 0.45: the strip read as mud). */
export const FILM_DIM = 0.3;

/** Chip pill height and type size (SYSTEM 8.9 said 56 / 28: about 10 pt on a phone, smaller than Instagram's own
 *  caption text). Chip, the cover label chips and the dock positions (elements/context.ts) all read these. */
export const CHIP_H = 64;
export const CHIP_SIZE = 32;

/** Source geometry (SYSTEM 3). */
export const SLIDE = { w: 1367, h: 912, srcX: 7, srcY: 84 } as const;
/** slide.mp4 proxy = source crop x6 y84 1368x912: slide-space x = proxy x + dx. */
export const SLIDE_PROXY = { w: 1368, h: 912, dx: -1, dy: 0 } as const;
/** cam.mp4 proxy = source crop x1502 y389 418x302: tile-local x = proxy x + dx. */
export const CAM_PROXY = { w: 418, h: 302, dx: -1, dy: 0 } as const;

/** Layout zones (SYSTEM 2), screen px. */
export const Z = {
  safeTop: 220,
  safeBottom: 1500,
  safeRight: 960,
  left: 60,
  hudRow: { x0: 60, x1: 960, y0: 232, y1: 332 },
  headline: { x0: 60, x1: 960, y0: 348, y1: 692, capTop: 356, maxWidth: 900 },
  railY: 344,
  stage: { x0: 40, x1: 1040, cx: 540, w: 1000, bodyTop: 360, slotTop: 716, bottom: 1210, endBottom: 1052 },
  cta: { x0: 60, x1: 960, y0: 1068, y1: 1226, capTop: 1078, pitch: 78, size: 72 },
  /** legacy circle (ALT still reads FaceCrop with its own geometry); the primary uses `cam` */
  bubble: { cx: 164, cy: 1352, d: 208 },
  /** camera block (client request: "deixa o bloco da câmera dele maior, pois corta o rosto dele"): rounded rect,
   *  230 x 230 px in the caption band's left, showing a 262-row window of the webcam tile. Upright he fits in rows
   *  4..266 (srcY0..srcY1, just above the burned-in "Nome do Apresentador" label); when he leans towards the screen his
   *  mouth and chin are BELOW row 266, so the window follows the head down to the tile's last row (srcYMax 302)
   *  and the label (tile x 14-134, y 271-293) is painted out by an opaque tab pinned to it (`label` = the tile
   *  rect that is covered: everything left of x1 and below y0). */
  // second client pass ("pode deixar maiorzinho"): 230 -> 270 px, bottom at 1490 (safe 1500), captions moved right
  // third client pass (leva 4): "aumente bastante a foto do apresentador para preencher quase todo o espaço vazio do
  // quadrante de baixo": the block leaves the caption band and fills the bottom of the frame (660 x 420, centred,
  // y 1470-1890; partly under the Instagram UI zone, client's call). Captions and lockup take the full band width;
  // the name tag is a pill inside the block (bottom-left). Leva 3 values: cam 270 x 270 at (60,1220), caption
  // x 348..956 (cx 652, maxWidth 608), nameTag x 348.
  cam: { x: 228, y: 1470, w: 624, h: 396, radius: 36, srcY0: 4, srcY1: 266, srcYMax: 302, label: { x1: 140, y0: 267 } },
  caption: { cx: 508, cy: 1322, x0: 60, x1: 956, maxWidth: 896 },
  // client: "deixa o nome do apresentador sem tampar o rosto dele ... embaixo da foto dele mesmo" -> plain tag
  // under the block's left edge (block shrunk from 660 x 420 to make room)
  nameTag: { x: 232, y0: 1876, y1: 1908 },
  token: { hook: { x: 60, y: 240, size: 84 }, hud: { x: 60, y: 236, size: 48 } },
  kickerX: 164,
  kickerXNoToken: 60,
  kickerCy: 282,
  tagX: 124,
} as const;

/** Easings (SYSTEM 6). */
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
export const LINEAR = (t: number) => t;
export const POP_CONFIG = { damping: 14, stiffness: 220, mass: 0.6 } as const;
/** POP spring value (0 -> 1, overshoot <= 4 %) `f` frames after the trigger. */
export const pop = (f: number): number => (f <= 0 ? 0 : spring({ frame: f, fps: FPS, config: POP_CONFIG }));

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progress 0..1 of an animation that starts at `start` and lasts `dur` frames, eased. */
export const prog = (frame: number, start: number, dur: number, ease: (t: number) => number = LINEAR): number =>
  dur <= 0 ? (frame >= start ? 1 : 0) : ease(clamp01((frame - start) / dur));
/** 0 -> 1 -> 0 bump over `dur` frames starting at `start` (pulses: `1 + amp * bump(...)`). */
export const bump = (frame: number, start: number, dur: number, ease: (t: number) => number = OUT): number => {
  const t = (frame - start) / dur;
  if (t <= 0 || t >= 1) return 0;
  return t < 0.5 ? ease(t * 2) : 1 - INOUT((t - 0.5) * 2);
};
/** Largest bump of a list of trigger frames. */
export const bumps = (frame: number, starts: number[], dur: number): number => {
  let m = 0;
  for (const s of starts) m = Math.max(m, bump(frame, s, dur));
  return m;
};

export const TOKENS = { C, dim, FONT, STROKE, SLIDE, Z, FPS, W, H } as const;
export const EASE = { OUT, INOUT, LINEAR, pop, prog, bump, bumps, clamp01, lerp } as const;
