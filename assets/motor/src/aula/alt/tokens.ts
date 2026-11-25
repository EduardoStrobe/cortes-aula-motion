// ALT format "Negatoscopio" (spec/ALT.md) — layout zones and the one ALT-only colour. OWNER: ALT author.
// Everything else (colour tokens, easings, fonts) comes from ../tokens.
//
// REVIEW ROUND 1 (this layout replaces ALT.md section 2 where they disagree):
//   * CLIENT REQUEST: the round face bubble (d 180) is gone. The doctor's camera is the engine's camera block
//     (Z.cam: 270 x 270 px at x 60, y 1220, rounded rectangle, <CamCrop>), exactly as in the approved primary cut.
//     Nothing of the lightbox sits under it: the panel now ends at y 1204 (was 1240).
//   * Everything in the caption band moved right of the block: x 348..956 (Z.caption), as in the primary.
//   * Border label: 36 px type in a 58 px tab with a 36 px glyph badge (was 26 px / 20 px: unreadable on a phone).
//   * Closing: CTA 64 px (auto-fit) + the pill button, film at 28 % (was 12 %: the open spot pointed at nothing).
import { Z } from "../tokens";

/** Lightbox fill = the brand light token (ALT.md 2). ALT-only: it must never be used for type. */
export const LIGHTBOX = "#F4FCFE";
export const lightbox = (a: number) => `rgba(244,252,254,${a})`;

/** Layout, canvas px. */
export const A = {
  panel: { x0: 30, x1: 1050, bottom: 1204, bodyTop: 300, bandTop: 620, radius: 20 },
  /** the film window sits 20 px inside the panel on every side */
  inset: 20,
  windowRadius: 4,
  clip: { w: 64, h: 28, cx: [290, 790] as const, radius: 6 },
  /** frames of the panel top-edge move (hook exit: OUT; closing pre-roll: INOUT) */
  edgeDur: 18,
  /** camera block = the engine's (second client pass: 270 px) */
  cam: Z.cam,
  kicker: { x: 60, cy: 254, size: 30, tracking: 0.14, maxWidth: 900 },
  /** headline / end question: bottom-aligned to the band (last baseline `gap` px above the panel's top edge), so
   *  there is never an empty strip between the type and the lightbox; cap-top never above `minTop` */
  head: { x: 60, minTop: 298, gap: 46, maxWidth: 900, floor: 76, pitch: 1.08 },
  label: { x: Z.caption.x0, y: 1204, h: 58, pad: 20, size: 36, radius: 14, glyph: 36, glyphGap: 14 },
  caption: { x0: Z.caption.x0, x1: Z.caption.x1, cy: [1322, 1392] as const, size: 58, maxChars: 19, floor: 46 },
  nameTag: { x: Z.nameTag.x, cy: 1892, cyAlone: 1892, size: 26, tracking: 0.14 },
  /** closing, top to bottom right of the block: CTA rows, pill (y 1364..1432), name tag (cap-top about 1460) */
  cta: { x: Z.caption.x0, x1: Z.caption.x1, cy: [1250, 1320] as const, size: 64 },
  pill: { top: 1364, h: 68, size: 32, tracking: 0.08, dot: 12, dotGap: 14, pad: 28 },
  lockup: { logoX: 60, logoY: 234, logoH: 40, logoW: 215, nameX: 299, nameCy: 254, nameSize: 26, maxRight: 960 },
} as const;

/** Closing timeline after T (C = frame - T). */
export const ALT_CLOSING = { cta1: 12, cta2: 15, sweep: 24, pill: 34, pillText: 40, pillLand: 45, pillPulse: 74, logo: 30, lesson: 36, push0: 30 } as const;

/** Light states (ALT.md 2 / 5.2). OFF: the film stays readable as a silhouette (0.28; at 0.12 the kept mark sat on
 *  plain black). */
export const LIT = { fill: 1, film: 1, glow: 1 } as const;
export const OFF = { fill: 0.1, film: 0.28, glow: 0 } as const;
export const FLICK = { fill: 0.4, film: 0.35, glow: 0.3 } as const;
/** brightness of the film INSIDE the kept Lupa after the relay is off (the lit spot) */
export const SPOT = 0.72;

/** Total magnification limit of the Lupa (camera s x lens), ALT.md 5.5 / 10. */
export const MAG_MAX = 2.0;
