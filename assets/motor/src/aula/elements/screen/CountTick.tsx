// CountTick — SYSTEM 8.13. OWNER: screen-group element author.
// 52 px circle in SCREEN px centred on the slide point `pos` (constant size under any camera). (SYSTEM said 40 px
// with a 24 px numeral: too small to read on a phone.)
//   current   accent fill, numeral graphite (30 px)
//   previous  fill dim(0.88), 1 px accent border, numeral white, 55 % opacity. A tick becomes "previous" (6 f
//             cross-fade) when the next CountTick beat of the cut (by frame, any `n`) pops.
//   leader    1 px text2 line from the circle's edge to `leaderTo`, drawn in 6 f. It starts on `leaderAt`, else
//             when the Trace beat named by `trace` completes (its cursor[1], or its at + draw), else at + 6;
//             never before the numeral itself pops.
//   in        scale 0 -> 1, 6 f POP.   out: engine fade (6 f).
//   fadeTo    opacity steps (6 f linear). The step caps the whole tick: opacity = min(state opacity, step), so
//             "40 %" means 40 % for the current and the previous ticks alike; the leader takes the step only.
//   sound     tick on n = 1, 3 and 8 only (SYSTEM 11).
import { C, defineElement, dim, lerp, pop, prog, Txt, type Anchor, type Pt, type ResolvedBeat } from "../api";
import { Border, stepOpacity } from "./shared";

export interface CountTickProps {
  n: number;
  /** slide point of the circle centre */
  pos: Pt;
  /** slide point the leader ends on (the trace end) */
  leaderTo: Pt;
  /** frame anchor on which the leader draws (default: the end of the Trace named by `trace`, else at + 6) */
  leaderAt?: Anchor;
  /** beat id of the matching Trace (its completion triggers the leader) */
  trace?: string;
  /** opacity steps (c2: 0.4 at f 849) */
  fadeTo?: { at: Anchor; opacity: number }[];
}

const D = 52;
const NUM = 30;
const SWAP = 6;

export const CountTick = defineElement<CountTickProps>({
  defaultUntil: "closing",
  cues: (beat) => ([1, 3, 8].includes(beat.props.n) ? [{ f: beat.at, cue: "tick" }] : []),

  // leader: slide-space line (it follows the camera), 1 SCREEN px wide
  Slide: ({ ctx }) => {
    const { props, frame, at } = ctx;
    let start = at + 6;
    if (props.leaderAt) start = ctx.fr(props.leaderAt);
    else if (props.trace) {
      const tb = ctx.r.beats.find((b) => b.id === props.trace) as ResolvedBeat<{ cursor?: [number, number]; draw?: number }> | undefined;
      if (!tb) throw new Error(`[aula] CountTick "${ctx.beat.id}": trace "${props.trace}" is not a beat of this storyboard`);
      start = tb.props.cursor ? tb.props.cursor[1] : tb.at + (tb.props.draw ?? 14);
    }
    start = Math.max(start, at);
    const k = prog(frame + 1, start, 6);
    if (k <= 0) return null;
    const [x0, y0] = props.pos;
    const [x1, y1] = props.leaderTo;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const r = ctx.px(D / 2);
    if (len <= r) return null;
    const ax = x0 + ((x1 - x0) / len) * r;
    const ay = y0 + ((y1 - y0) / len) * r;
    return (
      <line x1={ax} y1={ay} x2={lerp(ax, x1, k)} y2={lerp(ay, y1, k)} stroke={C.text2} strokeWidth={ctx.px(2)}
        opacity={stepOpacity(props.fadeTo, ctx.fr, frame)} />
    );
  },

  Screen: ({ ctx }) => {
    const { props, frame, at, age } = ctx;
    if (age < 0) return null;
    // "previous" from the frame the next CountTick of the cut pops
    let next = Infinity;
    for (const b of ctx.r.beats) {
      if (b.el !== ctx.beat.el || b.pane !== ctx.pane || b.id === ctx.beat.id) continue;
      if (b.at > at || (b.at === at && b.index > ctx.beat.index)) next = Math.min(next, b.at);
    }
    const prev = Number.isFinite(next) ? prog(frame + 1, next, SWAP) : 0;
    const opacity = Math.min(lerp(1, 0.55, prev), stepOpacity(props.fadeTo, ctx.fr, frame));
    const [x, y] = ctx.toScreen(props.pos);
    const label = String(props.n);
    return (
      <div style={{
        position: "absolute", left: x - D / 2, top: y - D / 2, width: D, height: D, opacity,
        transform: `scale(${pop(age + 1)})`, transformOrigin: "50% 50%",
      }}>
        {/* previous look underneath */}
        <div style={{ position: "absolute", inset: 0, borderRadius: D / 2, background: dim(0.88) }}>
          <Border radius={D / 2} color={C.accent} />
          <Txt cx={D / 2} capCenter={D / 2} size={NUM}>{label}</Txt>
        </div>
        {/* current look on top, fading away when the next tick arrives */}
        <div style={{ position: "absolute", inset: 0, borderRadius: D / 2, background: C.accent, opacity: 1 - prev }}>
          <Txt cx={D / 2} capCenter={D / 2} size={NUM} color={C.graphite}>{label}</Txt>
        </div>
      </div>
    );
  },
});
