// Ring — SYSTEM 8.10. OWNER: slide-group element author.
// SVG ellipse in SLIDE space: 3 px accent + 5 px dim(0.5) under-stroke (screen px, constant under any camera
// scale), drawn clockwise from 12 o'clock, then it breathes (scale 1 -> 1.04 -> 1, 45 f sine loop, for as long as
// the beat lives, so kept rings keep breathing through the closing). Pulse: scale 1 -> 1.12 -> 1, 8 f.
// Squeeze: scale 1 -> 0.94 -> 1, 10 f. All scales change the RADII (the stroke width never changes).
//
// Storyboard rows covered: c1 ringHookA/B (in hook panes, draw 10), c1 ringA (draw 0: "the coin becomes the
// ring"; pulses), c1 ringB (draw 10), c3 ringMass (rx 110, ry 128, draw 37, squeeze).
//
// Props beyond the SYSTEM text (all optional):
//   draw: 0        the ring appears fully drawn and fades in over 4 f (it is the other half of the 4-frame
//                  cross-fade of CoinProp `fly`, c1 beat 2/2c).
//   drawEase       "out" | "linear" | "inout". Default: "out" (SYSTEM 6) for draws up to 16 f, "linear" for longer
//                  ones: c3 asks for a 37-frame draw "in step with his circling", and OUT would finish 80 % of the
//                  ring in the first quarter of that time.
//   start, dir     where the stroke starts (degrees clockwise from 12 o'clock, default 0) and which way it runs
//                  ("cw" default | "ccw"). In c3 the doctor circles the mass counter-clockwise starting near
//                  2 o'clock (cursor f 960-1002), so that cut can follow his hand with start 65, dir "ccw".
//   breathe        false = no breathing (default true).
// No sound cue: SYSTEM 11 gives rings none (the tick on "ring pulse" rows belongs to the chip roll).
import { defineElement, frames, type Anchor, type Pt } from "../api";
import { breatheScale, cutByJoin } from "./shared";

export interface RingProps {
  c: Pt;
  rx: number;
  /** default = rx (circle) */
  ry?: number;
  /** frames of the draw-on (default 10; 0 = appears fully drawn) */
  draw?: number;
  pulses?: Anchor[];
  /** scale 1 -> 0.94 -> 1, 10 f */
  squeeze?: Anchor;
  /** [added] easing of the draw-on (default "out" up to 16 f, "linear" above) */
  drawEase?: "out" | "linear" | "inout";
  /** [added] start of the stroke, degrees clockwise from 12 o'clock (default 0) */
  start?: number;
  /** [added] drawing direction (default "cw") */
  dir?: "cw" | "ccw";
  /** [added] false = no breathing */
  breathe?: boolean;
}

export const Ring = defineElement<RingProps>({
  defaultUntil: "closing",
  Slide: ({ ctx }) => {
    const { props, frame, at, ease, tokens: { C, dim, STROKE } } = ctx;
    if (cutByJoin(ctx)) return null;
    const draw = props.draw ?? 10;
    const easeName = props.drawEase ?? (draw <= 16 ? "out" : "linear");
    const fn = easeName === "out" ? ease.OUT : easeName === "inout" ? ease.INOUT : ease.LINEAR;
    const drawn = draw > 0 ? ease.prog(frame + 1, at, draw, fn) : 1;
    if (drawn <= 0) return null;
    const appear = draw > 0 ? 1 : ease.clamp01((frame + 1 - at) / 4);

    const k = (props.breathe === false ? 1 : breatheScale(frame, at + draw))
      * (1 + 0.12 * ease.bumps(frame, frames(ctx, props.pulses), 8))
      * (1 - 0.06 * (props.squeeze ? ease.bump(frame, ctx.fr(props.squeeze), 10) : 0));
    const [cx, cy] = props.c;
    const rx = props.rx * k;
    const ry = (props.ry ?? props.rx) * k;

    const a0 = ((props.start ?? 0) * Math.PI) / 180;
    const x0 = cx + rx * Math.sin(a0);
    const y0 = cy - ry * Math.cos(a0);
    const x1 = cx - rx * Math.sin(a0);
    const y1 = cy + ry * Math.cos(a0);
    const sweep = props.dir === "ccw" ? 0 : 1;
    const d = `M ${x0} ${y0} A ${rx} ${ry} 0 1 ${sweep} ${x1} ${y1} A ${rx} ${ry} 0 1 ${sweep} ${x0} ${y0}`;
    const done = drawn >= 1;
    const common = {
      d, fill: "none", strokeLinecap: "round" as const,
      ...(done ? {} : { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - drawn }),
    };
    return (
      <g opacity={appear}>
        <path {...common} stroke={dim(0.5)} strokeWidth={ctx.px(STROKE.markUnder)} />
        <path {...common} stroke={C.accent} strokeWidth={ctx.px(STROKE.mark)} />
      </g>
    );
  },
});
