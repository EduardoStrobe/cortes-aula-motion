// Guide — SYSTEM 8.14. OWNER: slide-group element author.
// A straight polyline through `points` (SLIDE space): 2 px white 72 % (`text2`), dash 8 6 (screen px, constant
// under any camera scale) over a 4 px dim(0.5) under-stroke (shared.WHITE_UNDER), drawn from the first point to
// the last in 12 f (INOUT). It only CONNECTS two marked objects (c1 `link`: ring A -> ring B); never a midline or
// a ruler.
// Prop beyond the SYSTEM text (optional): `draw` = frames of the draw-on (default 12).
import { defineElement, type Pt } from "../api";
import { cutByJoin, cutPolyline, polyPath, WHITE_UNDER } from "./shared";

export interface GuideProps {
  points: Pt[];
  /** [added] frames of the draw-on (default 12) */
  draw?: number;
}

export const Guide = defineElement<GuideProps>({
  defaultUntil: "closing",
  Slide: ({ ctx }) => {
    const { props, frame, at, ease, tokens: { C, dim, STROKE } } = ctx;
    if (cutByJoin(ctx) || props.points.length < 2) return null;
    const t = ease.prog(frame + 1, at, props.draw ?? 12, ease.INOUT);
    if (t <= 0) return null;
    const line = {
      d: polyPath(cutPolyline(props.points, t)), fill: "none", strokeDasharray: `${ctx.px(8)} ${ctx.px(6)}`,
      strokeLinejoin: "round" as const,
    };
    return (
      <>
        {WHITE_UNDER > 0 ? <path {...line} stroke={dim(0.5)} strokeWidth={ctx.px(STROKE.guide + WHITE_UNDER)} /> : null}
        <path {...line} stroke={C.text2} strokeWidth={ctx.px(STROKE.guide)} />
      </>
    );
  },
});
