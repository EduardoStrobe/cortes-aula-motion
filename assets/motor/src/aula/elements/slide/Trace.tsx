// Trace — SYSTEM 8.12. OWNER: slide-group element author.
// A line on the film, in SLIDE space, 3 px accent + 5 px dim(0.5) under-stroke (screen px), round caps.
//   points   Catmull-Rom path through the points, drawn over `draw` frames, linear (default 14), from the beat.
//   cursor   LIVE pen [f0, f1]: on frame f the path runs through ctx.cursor.path(f0, min(f, f1)) (repeated samples
//            dropped, 5-sample moving average, Catmull-Rom); after f1 it stays. Time is ctx.videoFrame, so the
//            pen stays glued to the picture through freezeStageAt and the closing. Nothing is drawn before f0
//            (the beat may start earlier, e.g. c3 trLive: beat f 853, cursor from f 857).
//            If the whole interval has fewer than 3 samples and `points` is given, `points` is drawn instead over
//            f1 - f0 frames starting at f0 (the storyboards' "fallback polyline").
//   headDot  10 px white dot (with a 1.5 px dim(0.5) rim, same idea as the under-stroke) at the path's current end.
//            It stays on the end of a finished path.
//   pulses   stroke-width 3 -> 5 -> 3 (under-stroke 5 -> 7 -> 5), 8 f.
//   style    "ghost" = 2 px white 72 % (`text2`), dash 8 6 (screen px) over a 4 px dim(0.5) under-stroke
//            (shared.WHITE_UNDER) (c3 displaced copy).
//
// Storyboard rows covered: c2 rib traces x 8 (LIVE + fallback points, fadeTo 0.4 at f 849), c3 trA (points, draw
// 26, head dot, hook), c3 ghostA (ghost, shift +70, blinks), c3 trB (points, draw 14, head dot), c3 trLive (LIVE,
// head dot, pulse, kept, frozen stage), c6 trFold (LIVE + fallback, kept).
//
// Props beyond the SYSTEM text (optional; fadeTo / shift / blinks were already in the engine stub):
//   fadeTo   opacity steps, 8 f linear each (c2: 0.4 at f 849).
//   shift    the whole path translates by (dx, dy) slide px over `dur` frames (default 10, OUT) from `at`.
//   blinks   opacity 1 -> 0.3 -> 1 -> 0.3 over 12 f, then it STAYS at 0.3 until the beat exits (c3 ghostA
//            "blinks twice and fades").
//   flashes  [added] opacity 1 -> 0.4 -> 1, 8 f (c3 beat 10d "trLive opacity pulse").
//   draw     for style "ghost" the default is 0: the copy appears whole (4 f fade-in) and then shifts.
import { catmullRomPath, defineElement, frames, type Anchor, type Pt } from "../api";
import { cutByJoin, cutPolyline, polyPath, sampleSpline, stepOpacity, WHITE_UNDER } from "./shared";

export interface TraceProps {
  points?: Pt[];
  /** frames of the draw-on for `points` (default 14; ghost: 0) */
  draw?: number;
  /** [f0, f1] absolute frames of the cursor track */
  cursor?: [number, number];
  /** 10 px white dot at the current end of the path */
  headDot?: boolean;
  /** stroke-width 3 -> 5 -> 3, 8 f */
  pulses?: Anchor[];
  /** "ghost" = 2 px white 72 %, dash 8 6 (c3 displaced copy) */
  style?: "accent" | "ghost";
  /** opacity steps (c2: 0.4 at f 849) */
  fadeTo?: { at: Anchor; opacity: number }[];
  /** c3 ghost: the whole path translates by (dx, dy) slide px over `dur` frames (default 10, OUT) from `at` */
  shift?: { at: Anchor; dx: number; dy?: number; dur?: number };
  /** c3 ghost: opacity 1 -> 0.3 -> 1 -> 0.3 over 12 f */
  blinks?: Anchor[];
  /** [added] opacity 1 -> 0.4 -> 1, 8 f */
  flashes?: Anchor[];
}

/** opacity of the blink that started `d` frames ago: 1 -> 0.3 -> 1 -> 0.3 in three 4-frame legs, then 0.3 */
const blinkOpacity = (d: number): number => {
  if (d <= 0) return 1;
  if (d >= 12) return 0.3;
  const leg = Math.floor(d / 4);
  const t = (d - leg * 4) / 4;
  return leg === 1 ? 0.3 + 0.7 * t : 1 - 0.7 * t;
};

export const Trace = defineElement<TraceProps>({
  defaultUntil: "closing",
  Slide: ({ ctx }) => {
    const { props, frame, at, ease, tokens: { C, dim, STROKE } } = ctx;
    if (cutByJoin(ctx)) return null;
    const ghost = props.style === "ghost";

    // ---- geometry: path data + current end point -------------------------------------------------------------
    let d = "";
    let head: Pt | null = null;
    let appear = 1;
    const drawPoints = (pts: Pt[], start: number, dur: number) => {
      const t = dur > 0 ? ease.prog(frame + 1, start, dur) : frame >= start ? 1 : 0;
      if (t <= 0 || pts.length === 0) return;
      const line = cutPolyline(sampleSpline(pts), t);
      d = polyPath(line);
      head = line[line.length - 1];
      if (dur <= 0) appear = ease.clamp01((frame + 1 - start) / 4);
    };
    if (props.cursor) {
      const [f0, f1] = props.cursor;
      const whole = ctx.cursor.path(f0, f1);
      if (whole.length >= 3 || !props.points) {
        const vf = ctx.videoFrame;
        if (vf >= f0) {
          const pts = ctx.cursor.path(f0, Math.min(vf, f1));
          if (pts.length >= 2) d = catmullRomPath(pts);
          if (pts.length >= 1) head = pts[pts.length - 1];
        }
      } else {
        drawPoints(props.points, f0, Math.max(1, f1 - f0));
      }
    } else if (props.points) {
      drawPoints(props.points, at, props.draw ?? (ghost ? 0 : 14));
    }
    if (!d && !head) return null;

    // ---- look ------------------------------------------------------------------------------------------------
    const bump = ease.bumps(frame, frames(ctx, props.pulses), 8);
    let opacity = appear * stepOpacity(ctx, props.fadeTo);
    for (const b of frames(ctx, props.blinks)) opacity *= blinkOpacity(frame - b);
    opacity *= 1 - 0.6 * ease.bumps(frame, frames(ctx, props.flashes), 8);

    let tx = 0;
    let ty = 0;
    if (props.shift) {
      const k = ease.prog(frame + 1, ctx.fr(props.shift.at), props.shift.dur ?? 10, ease.OUT);
      tx = props.shift.dx * k;
      ty = (props.shift.dy ?? 0) * k;
    }
    const line = { d, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    const dash = { strokeLinecap: "butt" as const, strokeDasharray: `${ctx.px(8)} ${ctx.px(6)}` };
    const hp = head as Pt | null;
    return (
      <g opacity={opacity} transform={tx || ty ? `translate(${tx} ${ty})` : undefined}>
        {d && !ghost ? <path {...line} stroke={dim(0.5)} strokeWidth={ctx.px(STROKE.markUnder + 2 * bump)} /> : null}
        {d && ghost && WHITE_UNDER > 0
          ? <path {...line} {...dash} stroke={dim(0.5)} strokeWidth={ctx.px(STROKE.guide + WHITE_UNDER + bump)} />
          : null}
        {d ? (
          ghost
            ? <path {...line} {...dash} stroke={C.text2} strokeWidth={ctx.px(STROKE.guide + bump)} />
            : <path {...line} stroke={C.accent} strokeWidth={ctx.px(STROKE.mark + 2 * bump)} />
        ) : null}
        {props.headDot && hp ? (
          <>
            <circle cx={hp[0]} cy={hp[1]} r={ctx.px(6.5)} fill={dim(0.5)} />
            <circle cx={hp[0]} cy={hp[1]} r={ctx.px(5)} fill={C.white} />
          </>
        ) : null}
      </g>
    );
  },
});
