// c5 — cut module. OWNER: the c5 cut author.
//
// RibArc (SYSTEM 8.22): ONE stroke that morphs between a curved rib arc and a straightened one ("retificação"
// drawn literally). It is a drawing, never a measurement: it only lives in the token and in the PropCard.
//
//   drawing   curved  M .1 .65 Q .5 .05 .9 .65        flat  M .1 .5 Q .5 .5 .9 .5        (0..1 box)
//             white stroke (2.5 px in the token, 4.5-5 px in the card and the big hook token; it was 2 px, a hairline
//             at feed size), transparent fill, ONE accent detail: the dot on its left end (it rides the end).
//             While the stroke is away from the curved state a dashed ghost of the curved state stays behind at
//             30 % (it fades in as the stroke leaves it), so "flat" always reads as "it WAS an arc".
//   moves     flatten   k -> 1 (flat), 14 f (dur overrides)
//             curve     k -> 0 (curved), 14 f
//             loop      flatten 14 f, hold 6 f, curve 14 f, hold 6 f = 40 f (dur = whole period). Starts from the
//                       state it finds (from flat it begins with the curve half). A "loop" that arrives while a
//                       loop is already running is ignored, so the hook loop (started at f 0 through
//                       tokenMoves[]) is not restarted by hook.tokenMove at accentAt.
//             Every move starts from the value the previous one had reached on that frame (no jumps). Unknown
//             names are ignored. flatten / curve also pulse the accent dot (1 -> 1.5 -> 1, 8 f), like a chip dot.
//             blink     the prop is hidden for `dur` frames (it does not touch the morph).
//   intro     with `appear` (card, film): the stroke draws from the dot end in 8 f and the dot pops.
//   film      same drawing over a 4 px dim(0.5) under-stroke (legibility on bone). Not used by the c5 storyboard:
//             the cut must not put rib-like lines on the radiograph (c5.md, MUST NOT REVEAL).
import React from "react";
import {
  bump, bumps, C, clamp01, defineElement, dim, fitSize, frames, INOUT, lerp, moveSpecs, OUT, pop, prog, PropSvg, textWidth, Txt,
  type Anchor, type Dock, type ElementDef, type MoveSpec, type PropComponent, type PropMove,
} from "../elements/api";
import { Border, dockBox, HeroDim } from "../elements/screen/shared";

const MOVE_DUR = 14;
const LOOP_PERIOD = 40;
const KNOWN = ["flatten", "curve", "loop"];

// curved (k = 0) and flat (k = 1) states
const X0 = 0.1;
const X1 = 0.9;
const END_Y = [0.65, 0.5] as const;
const CTRL_Y = [0.05, 0.5] as const;

/** OUT with a 3 % overshoot (SYSTEM 6 allows <= 4 %): the stroke snaps straight and settles. */
const snap = (t: number) => {
  const u = clamp01(t) - 1;
  return 1 + 1.9 * u * u * u + 0.9 * u * u;
};

interface Seg { name: string; at: number; dur?: number; from: number }

const loopK = (from: number, t: number, period: number): number => {
  const a = (period * 14) / 40;
  const h = (period * 6) / 40;
  const startFlat = from >= 0.5;
  const cycle = Math.floor(t / period);
  const u = t - cycle * period;
  const first = startFlat ? 0 : 1; // target of the first half
  const begin = cycle === 0 ? from : 1 - first;
  if (u < a) return lerp(begin, first, INOUT(u / a));
  if (u < a + h) return first;
  if (u < 2 * a + h) return lerp(first, 1 - first, INOUT((u - a - h) / a));
  return 1 - first;
};

const segK = (s: Seg, frame: number): number => {
  const t = Math.max(0, frame - s.at);
  if (s.name === "loop") return loopK(s.from, t, Math.max(8, s.dur ?? LOOP_PERIOD));
  const target = s.name === "flatten" ? 1 : 0;
  return s.from + (target - s.from) * snap(t / Math.max(1, s.dur ?? MOVE_DUR));
};

/** Morph value at `frame` (0 = curved, 1 = flat; may overshoot by 3 %) and the start of the last worded move. */
const arcState = (moves: PropMove[], frame: number): { k: number; lastWorded: number } => {
  let seg: Seg | null = null;
  let lastWorded = -1000;
  for (const m of moves) {
    if (m.at > frame) break;
    if (!KNOWN.includes(m.name)) continue;
    if (m.name === "loop" && seg && seg.name === "loop") continue;
    seg = { name: m.name, at: m.at, dur: m.dur, from: seg ? segK(seg, m.at) : 0 };
    if (m.name !== "loop") lastWorded = m.at;
  }
  return { k: seg ? segK(seg, frame) : 0, lastWorded };
};

// Paths are written in a 0..100 box and scaled by 0.01 into PropSvg's 0..1 viewBox: Chrome measures path lengths
// (pathLength / dashes) in USER units with an absolute tolerance, so a curve that is 1 unit long is measured as its
// chord and a dashed or drawing stroke ends at about 80 % of the arc.
const U = 100;
const arcPath = (k: number) => {
  const ey = lerp(END_Y[0], END_Y[1], k) * U;
  const cy = lerp(CTRL_Y[0], CTRL_Y[1], k) * U;
  return { d: `M ${X0 * U} ${ey} Q ${0.5 * U} ${cy} ${X1 * U} ${ey}`, ey };
};

export const Prop: PropComponent = ({ size, placement, frame, moves, appear, color = C.white, accent = C.accent }) => {
  const sorted = [...moves].sort((a, b) => a.at - b.at);
  const { k, lastWorded } = arcState(sorted, frame);
  const { d, ey } = arcPath(k);
  const ghost = arcPath(0).d;

  // intro: the stroke draws from the dot end, the dot pops
  // (quadratic ease-out, not the engine's OUT: OUT is 97 % done after 4 of the 8 frames, so the draw could not be
  // seen behind the card's own pop)
  const drawT = appear === undefined ? 1 : clamp01((frame + 1 - appear) / 8);
  const drawn = 1 - (1 - drawT) * (1 - drawT);
  const dotIn = appear === undefined ? 1 : Math.min(1.04, pop(frame + 1 - appear));
  const dotPulse = 1 + 0.5 * bump(frame, lastWorded, 8);

  const ghostOpacity = 0.3 * clamp01(k / 0.6) * (appear === undefined ? 1 : clamp01((frame - appear - 8) / 4));
  const dashPx = Math.min(10, Math.max(3.5, size * 0.05));
  const dotR = Math.max(4, size * 0.045);
  const film = placement === "film";
  // "blink": hidden for `dur` frames (default 10), back over the last 2. The storyboard uses it at H so the big hook
  // token does not fly THROUGH the collapsing headline on its way to the HUD.
  const bl = sorted.filter((m) => m.name === "blink" && frame >= m.at && frame < m.at + (m.dur ?? 10)).pop();
  const blink = bl ? clamp01((frame - (bl.at + (bl.dur ?? 10) - 3)) / 2) : 1;
  // review: the 2 px stroke was a hairline at feed size. 2.5 px in the 48-84 px token, 4.5-5 px in the card and in
  // the big hook token (the hero lift scales the card by about 2, so the arc is about 9 px there).
  const line = Math.min(5, Math.max(2.5, size * 0.024));

  return (
    <PropSvg size={size} style={blink < 1 ? { opacity: blink } : undefined}>
      {(sw) => {
        const px = (n: number) => sw(n) * U; // n screen px in path units
        const stroke = drawn < 1 ? { d, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - drawn } : { d };
        return (
          <g transform={`scale(${1 / U})`}>
            {ghostOpacity > 0.004 ? (
              <g opacity={ghostOpacity}>
                {film ? <path d={ghost} stroke={dim(0.5)} strokeWidth={px(line + 2)} /> : null}
                <path d={ghost} stroke={color} strokeWidth={px(Math.max(2, line * 0.6))} strokeDasharray={`${px(dashPx)} ${px(dashPx * 0.9)}`} />
              </g>
            ) : null}
            {drawn > 0 ? (
              <>
                {film ? <path {...stroke} stroke={dim(0.5)} strokeWidth={px(line + 2)} /> : null}
                <path {...stroke} stroke={color} strokeWidth={px(line)} />
              </>
            ) : null}
            <circle cx={X0 * U} cy={ey} r={px(dotR) * dotIn * dotPulse} fill={accent} stroke="none" />
          </g>
        );
      }}
    </PropSvg>
  );
};

// ---- ArcCard ------------------------------------------------------------------------------------------------------
// The RibArc's card (replaces the shared PropCard for this cut). Review findings it answers:
//   * the stamp notch was bare from the stage opening until the PropCard arrived (and during its hero entrance):
//     this card is DOCKED on the notch from the stage opening on, and an empty "home plate" stays there while the
//     card is away, so the notch never shows as an unexplained dark square;
//   * client: "quando ele falar ... traga animação": on `heroAt` ("retificação") the card LIFTS from its dock to the
//     middle of the dimmed stage (about 430 px, 8 f OUT), the arc straightens there, and it flies home (14 f INOUT);
//   * closing: listed in closing.keep it stays docked in the slot and keeps looping (the open question has a
//     moving object bigger than the 84 px token).
interface ArcCardProps {
  dock: Dock;
  size?: number;
  propSize?: number;
  /** the card lifts to the stage centre on this word */
  heroAt: Anchor;
  /** frames it stays in the centre after the lift (default 20) */
  hold?: number;
  moves?: MoveSpec[];
}
const LIFT = 8;
const FLY = 14;
const HERO_SIDE = 430;

const ArcCard = defineElement<ArcCardProps>({
  defaultUntil: "closing",
  cues: (beat, r) => [{ f: r.fr(beat.props.heroAt, `beat "${beat.id}"`), cue: "pop" }],
  Screen: ({ ctx }) => {
    const { props, frame, at, age } = ctx;
    if (age < 0) return null;
    const size = props.size ?? 208;
    const propSize = props.propSize ?? 188;
    const { left, top } = dockBox(ctx, props.dock, size, size);
    const heroAt = ctx.fr(props.heroAt);
    const up = prog(frame + 1, heroAt, LIFT, OUT);
    const down = prog(frame, heroAt + LIFT + (props.hold ?? 20), FLY, INOUT);
    const k = up * (1 - down); // 0 = docked, 1 = centred
    const st = ctx.stage;
    const s0 = Math.max(1, Math.min(HERO_SIDE / size, (st.h - 60) / size, (st.w - 60) / size));
    const dx = (st.cx - (left + size / 2)) * k;
    const dy = (st.cy - (top + size / 2)) * k;
    const P = ctx.Prop;
    const box: React.CSSProperties = {
      position: "absolute", left, top, width: size, height: size, borderRadius: 20, background: C.graphite2, overflow: "hidden",
    };
    return (
      <>
        {k > 0.001 ? <div style={box}><Border radius={20} /></div> : null}
        <HeroDim ctx={ctx} level={0.6 * k} />
        <div style={{
          ...box, transform: `translate(${dx}px, ${dy}px) scale(${pop(age + 1) * lerp(1, s0, k)})`, transformOrigin: "50% 50%",
        }}>
          <Border radius={20} />
          <div style={{ position: "absolute", left: (size - propSize) / 2, top: (size - propSize) / 2, width: propSize, height: propSize }}>
            <P size={propSize} placement="card" frame={frame} moves={moveSpecs(props.moves, ctx.fr)} appear={at} />
          </div>
        </div>
      </>
    );
  },
});

// ---- RibEquation --------------------------------------------------------------------------------------------------
// Replaces the shared EquationBar for this cut. Review BLOCKER: the bar read "A = B"
// as a bare claim for 1.7 s and then "OFTEN = B", the opposite of the speech, for 2.3 s; and
// its 32 / 22 px type was label-sized.
// A lower-third PANEL of the stage: full stage width, h 236, flush with the stage's bottom edge (the stage clip
// rounds its corners), cardFill, 1 px line on top; text from x 72, never past x 960. (A floating card left a 12-20 px
// rim of bright film around it that read as a white outline.) It slides up 60 px + fades in. Three stacked rows,
// read top to bottom as his sentence:
//   row 1  `left`        46 px caps, from the beat's frame                      ARCO COSTAL RETIFICADO
//   row 2  `connector`   34 px caps, text2: HIS OWN connector, wiped in on      COMO SE FOSSE
//                        `connectorAt` (20 f). There is NEVER a bare "=".
//          `doubtAt`     ("Muitas") the connector dims to 40 % and the card bumps: nothing is asserted yet.
//          `notAt`       ("não") the connector leaves (6 f) and the qualifier pill (56 px, 30 px caps, accent dot)
//                        opens together with the struck "=" (one glyph: two white bars + the accent diagonal).
//   row 3  `right`       58 px caps, letter-wipe from `rightAt` over `rightDur`; pulses 1 -> 1.08 -> 1 (10 f);
//                        dims to 45 % at `questionAt`, where the accent "?" pops after it.
// TRUTH RULE (c5.md, MUST NOT REVEAL), enforced by construction: the pill and the struck "=" are ONE state driven
// by ONE anchor (`notAt`): the struck "=" cannot exist without the pill, and the pill never sits next to an
// unstruck "=". The bar only ever exits as a whole (engine fade).
// Sound: tick on connectorAt, doubtAt and notAt.
// LOOKS (ENGINE.md 14; the default look is untouched by both):
//   * a look with a SPLIT page ("duas-cores"): the panel's top edge sits ON the split line (h = stageBottom - split.y,
//     212 px in the body instead of 236; the rows move up by 5/12, 2/3 and 11/12 of the difference: centres 40 / 102 /
//     164, which keeps 27 px under the last row for the cedilla and the stage's rounded corners), so the stage's part
//     on the lower surface is exactly the panel and the two edges read as one line (24 px apart they read as a
//     mistake);
//   * every pilot look: the two receded states keep 4.5 : 1 on the panel (connector in doubt 0.72 instead of 0.4,
//     right term in question 0.55 instead of 0.45; the approved values measure 2.6 and 4.1 : 1).
interface RibEquationProps {
  left: string;
  connector: string;
  right: string;
  connectorAt: Anchor;
  rightAt: Anchor;
  rightDur?: number;
  pulses?: Anchor[];
  doubtAt: Anchor;
  qualifier: string;
  notAt: Anchor;
  questionAt: Anchor;
}
const EQ = { h: 236, textX: 72, textX1: 960, row1: 50, row2: 118, row3: 186 };
const EQ_PILL = { h: 56, size: 30, tracking: 0.12, dot: 12, gap: 10, pad: 22 };
const EQ_OP = 56;

const RibEquation = defineElement<RibEquationProps>({
  defaultUntil: "closing",
  cues: (beat, r) => {
    const where = `beat "${beat.id}"`;
    return [
      { f: r.fr(beat.props.connectorAt, where), cue: "tick" },
      { f: r.fr(beat.props.doubtAt, where), cue: "tick" },
      { f: r.fr(beat.props.notAt, where), cue: "tick" },
    ];
  },
  Screen: ({ ctx }) => {
    const { props, frame, age } = ctx;
    if (age < 0) return null;
    const connAt = ctx.fr(props.connectorAt);
    const rightAt = ctx.fr(props.rightAt);
    const doubtAt = ctx.fr(props.doubtAt);
    const notAt = ctx.fr(props.notAt);
    const questionAt = ctx.fr(props.questionAt);

    const st = ctx.stage;
    const padX = EQ.textX - st.left;
    const inner = EQ.textX1 - EQ.textX;
    // [looks] see the header: panel height / row centres follow a split page, receded states stay readable
    const { look } = ctx;
    const pilot = look.id !== "default";
    const panelH = look.split ? Math.max(EQ.h - 36, Math.min(EQ.h, st.bottom - look.split.y)) : EQ.h;
    const tight = EQ.h - panelH;
    const row1 = EQ.row1 - (5 / 12) * tight;
    const row2 = EQ.row2 - (2 / 3) * tight;
    const row3 = EQ.row3 - (11 / 12) * tight;
    const connDim = pilot ? 0.72 : 0.4;
    const rightDim = pilot ? 0.55 : 0.45;
    const top = st.bottom - panelH;
    const kin = pop(age + 1);
    const cardBump = 1 + 0.03 * bumps(frame, [doubtAt, notAt], 10);

    // row 1
    const leftSize = fitSize(props.left, { size: 46, tracking: 0.08, caps: true }, inner, 26);

    // row 2: connector, then pill + struck "="
    const connStyle = { size: 34, tracking: 0.16, caps: true } as const;
    const connW = textWidth(props.connector, connStyle) + 6;
    const connReveal = clamp01((frame + 1 - connAt) / 20) * connW;
    const leave = prog(frame, notAt, 6, OUT);
    const connOpacity = lerp(1, connDim, prog(frame, doubtAt, 6)) * (1 - leave);
    const pillTextW = textWidth(props.qualifier, { size: EQ_PILL.size, tracking: EQ_PILL.tracking, caps: true });
    const pillW = EQ_PILL.pad + EQ_PILL.dot + EQ_PILL.gap + pillTextW + EQ_PILL.pad;
    const open = prog(frame, notAt + 2, 10, INOUT);
    const opK = pop(frame - (notAt + 5));

    // row 3
    const qGap = 14;
    let rSize = 58;
    const rowW = (sz: number) =>
      textWidth(props.right, { size: sz, tracking: 0.08, caps: true }) * 1.08 + qGap + textWidth("?", { size: sz });
    while (rSize > 30 && rowW(rSize) > inner) rSize--;
    const rightStyle = { size: rSize, tracking: 0.08, caps: true } as const;
    const rightW = textWidth(props.right, rightStyle);
    const dur = props.rightDur ?? 45;
    const chars = Array.from(props.right);
    const lp = clamp01((frame + 1 - rightAt) / Math.max(1, dur)) * chars.length;
    const li = Math.min(chars.length, Math.floor(lp));
    const prefixW = (n: number) =>
      (n <= 0 ? 0 : n >= chars.length ? rightW + 4 : textWidth(chars.slice(0, n).join(""), rightStyle) + (rSize * 0.08) / 2);
    const reveal = frame < rightAt ? 0 : lerp(prefixW(li), prefixW(li + 1), OUT(lp - li));
    const rightScale = 1 + 0.08 * bumps(frame, frames(ctx, props.pulses), 10);
    const rightOpacity = lerp(1, rightDim, prog(frame, questionAt, 6));
    const qK = pop(frame - questionAt + 1);

    return (
      <div style={{
        position: "absolute", left: st.left, top, width: st.w, height: panelH,
        background: C.cardFill, overflow: "hidden", opacity: clamp01(kin * 2),
        transform: `translateY(${(1 - Math.min(1, kin)) * 60}px) scale(${cardBump})`, transformOrigin: "50% 100%",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: st.w, height: 1, background: C.line }} />
        <Txt x={padX} capCenter={row1} size={leftSize} tracking={0.08} caps>{props.left}</Txt>

        {/* connector (his words) */}
        {frame >= connAt && connOpacity > 0.004 ? (
          <div style={{
            position: "absolute", left: padX, top: row2 - 30, width: connReveal, height: 60, overflow: "hidden",
            opacity: connOpacity, transform: `translateY(${-14 * leave}px)`,
          }}>
            <Txt x={0} capCenter={30} size={connStyle.size} tracking={connStyle.tracking} caps color={C.text2}>{props.connector}</Txt>
          </div>
        ) : null}

        {/* qualifier pill + struck "=": one state, one anchor */}
        {frame >= notAt + 2 ? (
          <>
            <div style={{
              position: "absolute", left: padX, top: row2 - EQ_PILL.h / 2, width: pillW * open, height: EQ_PILL.h,
              borderRadius: EQ_PILL.h / 2, background: C.graphite, overflow: "hidden", opacity: clamp01(open * 3),
            }}>
              <Border radius={EQ_PILL.h / 2} />
              <div style={{
                position: "absolute", left: EQ_PILL.pad, top: (EQ_PILL.h - EQ_PILL.dot) / 2, width: EQ_PILL.dot, height: EQ_PILL.dot,
                borderRadius: EQ_PILL.dot / 2, background: C.accent,
              }} />
              <Txt x={EQ_PILL.pad + EQ_PILL.dot + EQ_PILL.gap} capCenter={EQ_PILL.h / 2} size={EQ_PILL.size} tracking={EQ_PILL.tracking} caps>
                {props.qualifier}
              </Txt>
            </div>
            {opK > 0 ? (
              <svg width={EQ_OP} height={EQ_OP} viewBox="0 0 44 44" style={{
                position: "absolute", left: padX + pillW + 18, top: row2 - EQ_OP / 2, overflow: "visible",
                transform: `scale(${opK})`, transformOrigin: "50% 50%",
              }}>
                <path d="M 7 16 H 37 M 7 28 H 37" stroke={C.white} strokeWidth={4.5} strokeLinecap="round" fill="none" />
                <path d="M 12 39 L 32 5" stroke={C.accent} strokeWidth={4.5} strokeLinecap="round" fill="none" />
              </svg>
            ) : null}
          </>
        ) : null}

        {/* right term (letter-wipe) */}
        <div style={{
          position: "absolute", left: padX, top: row3 - 42, width: reveal, height: 84, overflow: "hidden", opacity: rightOpacity,
          transform: `scale(${rightScale})`, transformOrigin: "0% 50%",
        }}>
          <Txt x={0} capCenter={42} size={rSize} tracking={0.08} caps>{props.right}</Txt>
        </div>
        {frame >= questionAt ? (
          <div style={{
            position: "absolute", left: padX + rightW + qGap, top: row3 - 42, width: 60, height: 84,
            transform: `scale(${qK})`, transformOrigin: "20% 50%",
          }}>
            <Txt x={0} capCenter={42} size={rSize} color={C.accent}>?</Txt>
          </div>
        ) : null}
      </div>
    );
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const elements: Record<string, ElementDef<any>> = { ArcCard, RibEquation };
