// Brackets — SYSTEM 8.11. OWNER: slide-group element author.
// REVIEW: the corners are now STROKE.guide (3 px) over a 5 px under-stroke with 40 px arms (were 2 px / 24 px: "thin
// and faint" on a phone), and a `fadeTo` step to 0.4 is shown at 0.6 (c4: the lung brackets vanished at 0.4).
// Four white 2 px L-corners (over a 4 px dim(0.5) under-stroke, see shared.WHITE_UNDER) with 24 px arms (SCREEN
// px, constant under any camera scale; an arm is never longer than half the rect's side) at the corners of a
// SLIDE-space rect.
// In (SYSTEM 6): each corner travels 20 screen px inward along its diagonal, opacity 0 -> 1, 8 f OUT, starting
// `delay` frames after the beat. Pulse: the rect scales 1 -> 1.12 -> 1 about its centre, 8 f (stroke width and arm
// length do not scale). `fadeTo`: opacity steps, 8 f linear each.
//
// Storyboard rows covered: c2 brClav / brEnd ("breathes"), c4 brL / brR (fadeTo 0.4 at f 787), c4 brSpine (pulses,
// kept), c5 brRibs (delay 2, pulse, kept).
//
// Props beyond the SYSTEM text (optional):
//   breathe   true = the rect breathes like a ring (scale 1 -> 1.02 -> 1, 45 f sine) once it is in (c2 brEnd).
//             The amplitude is half the ring's 4 % because brackets frame large regions (2 % of a 600 px band is
//             already 6 px per side). A bracket listed in closing.keep breathes from T on even without the prop
//             (SYSTEM 10.3: "kept marks keep breathing").
import { defineElement, frames, type Anchor, type Rect } from "../api";
import { breatheScale, cutByJoin, stepOpacity, WHITE_UNDER } from "./shared";

export interface BracketsProps {
  rect: Rect;
  pulses?: Anchor[];
  /** opacity steps (c4: 0.4 at f 787) */
  fadeTo?: { at: Anchor; opacity: number }[];
  /** frames after the beat `at` before the corners draw (c5: 2) */
  delay?: number;
  /** [added] breathe once in (c2 brEnd) */
  breathe?: boolean;
}

const IN = 8;
const ARM = 40;
/** fadeTo remap: a step to 0.4 shows as 0.6, 1 stays 1, 0 stays 0 (continuous, monotone). */
const liftFade = (o: number) => (o >= 0.4 ? 0.6 + ((o - 0.4) * 0.4) / 0.6 : o * 1.5);

export const Brackets = defineElement<BracketsProps>({
  defaultUntil: "closing",
  Slide: ({ ctx }) => {
    const { props, frame, at, ease, closing, tokens: { C, dim, STROKE } } = ctx;
    if (cutByJoin(ctx)) return null;
    const start = at + (props.delay ?? 0);
    if (frame + 1 <= start) return null;
    const k = ease.prog(frame + 1, start, IN, ease.OUT);
    const travel = ctx.px(20) * (1 - k);

    const breatheFrom = props.breathe ? start + IN : closing.kept ? closing.T : Infinity;
    const scale = (1 + 0.12 * ease.bumps(frame, frames(ctx, props.pulses), 8)) * breatheScale(frame, breatheFrom, 0.02);
    const [x0, y0, x1, y1] = props.rect;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const hw = ((x1 - x0) / 2) * scale;
    const hh = ((y1 - y0) / 2) * scale;
    const arm = Math.min(ctx.px(ARM), hw, hh);

    let d = "";
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const X = cx + sx * (hw + travel);
        const Y = cy + sy * (hh + travel);
        d += `M ${X - sx * arm} ${Y} L ${X} ${Y} L ${X} ${Y - sy * arm} `;
      }
    }
    const line = { d, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    return (
      <g opacity={k * liftFade(stepOpacity(ctx, props.fadeTo))}>
        {WHITE_UNDER > 0 ? <path {...line} stroke={dim(0.5)} strokeWidth={ctx.px(STROKE.guide + WHITE_UNDER)} /> : null}
        <path {...line} stroke={C.white} strokeWidth={ctx.px(STROKE.guide)} />
      </g>
    );
  },
});
