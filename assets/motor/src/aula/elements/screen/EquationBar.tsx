// EquationBar — SYSTEM 8.19 (c5). OWNER: screen-group element author.
// Card x 60-940, h 124, top = stageBottom - 136 (it rides the stage's bottom edge), cardFill, 1 px border, radius 20.
//   row 1 (centre y +38)  `left`, 32 px caps +0.1em, from the beat's frame
//   row 2 (centre y +88)  16 px gaps, left to right:
//       qualifier pill  h 40, 22 px caps +0.12em, 10 px accent dot; inserted at qualifier.at: the pill opens (width
//                       0 -> full) while everything after it is pushed right, 12 f INOUT
//       "="             44x44 SVG, two 4 px white bars; pops at opAt (8 f POP)
//       right           32 px caps +0.1em; letter-wipe from rightAt over rightDur frames (letter by letter, left
//                       to right); pulses 1 -> 1.08 -> 1 (10 f); dims to 45 % at questionAt (6 f)
//       "?"             accent, 32 px, pops at questionAt (8 f POP)
//   strike          4 px accent diagonal through the "=" in 8 f (it becomes a not-equal sign).
//   TRUTH RULE      the struck "=" may only exist together with the qualifier pill: the element THROWS (already at
//                   storyboard resolution, through `cues`) unless strikeAt >= qualifier.at + 12 (pill fully open).
//                   The bar only ever exits as a whole (engine fade over the 6 frames after `until`).
//   in              card scale 0.9 -> 1 + opacity (8 f POP), like a chip.
//   sound           tick on qualifier.at and on strikeAt (c5 beats 4 and 6).
//   fit             if row 2 is wider than the card (60 px of padding), `right` and "?" shrink to fit (floor 22 px);
//                   row 1 shrinks the same way.
import {
  bumps, C, clamp01, defineElement, fitSize, frames, INOUT, lerp, OUT, pop, prog, textWidth, Txt, type Anchor,
} from "../api";
import { Border } from "./shared";

export interface EquationBarProps {
  left: string;
  right: string;
  /** "=" pops */
  opAt: Anchor;
  /** `right` starts its letter-wipe (left to right) */
  rightAt: Anchor;
  /** frames of the letter-wipe (default 45) */
  rightDur?: number;
  qualifier: { text: string; at: Anchor };
  strikeAt: Anchor;
  /** right term dims to 45 % and the accent "?" pops after it */
  questionAt: Anchor;
  /** right term scale 1 -> 1.08 -> 1 (10 f) */
  pulses?: Anchor[];
}

const CARD = { x0: 60, x1: 940, h: 124, lift: 136, radius: 20, padX: 30 };
const ROW1 = 38;
const ROW2 = 88;
const GAP = 16;
const OP = 44;
const PILL = { h: 40, size: 22, tracking: 0.12, dot: 10, gap: 8, pad: 16 };
const INSERT = 12;

const checkTruth = (id: string, strikeAt: number, qualifierAt: number) => {
  if (strikeAt < qualifierAt + INSERT) {
    throw new Error(`[aula] EquationBar "${id}": strikeAt (f ${strikeAt}) must come at least ${INSERT} f after qualifier.at (f ${qualifierAt}): `
      + "the struck \"=\" may only appear together with the qualifier pill");
  }
};

export const EquationBar = defineElement<EquationBarProps>({
  defaultUntil: "closing",
  cues: (beat, r) => {
    const where = `beat "${beat.id}"`;
    const q = r.fr(beat.props.qualifier.at, where);
    const s = r.fr(beat.props.strikeAt, where);
    checkTruth(beat.id, s, q);
    return [{ f: q, cue: "tick" }, { f: s, cue: "tick" }];
  },

  Screen: ({ ctx }) => {
    const { props, frame, age } = ctx;
    if (age < 0) return null;
    const opAt = ctx.fr(props.opAt);
    const rightAt = ctx.fr(props.rightAt);
    const qualAt = ctx.fr(props.qualifier.at);
    const strikeAt = ctx.fr(props.strikeAt);
    const questionAt = ctx.fr(props.questionAt);
    checkTruth(ctx.beat.id, strikeAt, qualAt);

    const inner = CARD.x1 - CARD.x0 - 2 * CARD.padX;
    const top = ctx.stage.bottom - CARD.lift;
    const kin = pop(age + 1);

    // row 1
    const leftSize = fitSize(props.left, { size: 32, tracking: 0.1, caps: true }, inner, 22);

    // row 2 metrics (settled layout decides the type size, so nothing re-flows later)
    const pillTextW = textWidth(props.qualifier.text, { size: PILL.size, tracking: PILL.tracking, caps: true });
    const pillW = PILL.pad + PILL.dot + PILL.gap + pillTextW + PILL.pad;
    const qGap = 12;
    const fixed = pillW + GAP + OP + GAP + qGap;
    let rSize = 32;
    const rowW = (s: number) =>
      fixed + textWidth(props.right, { size: s, tracking: 0.1, caps: true }) + textWidth("?", { size: s });
    while (rSize > 22 && rowW(rSize) > inner) rSize--;
    const rightStyle = { size: rSize, tracking: 0.1, caps: true } as const;
    const rightW = textWidth(props.right, rightStyle);

    // qualifier insert
    const ins = prog(frame, qualAt, INSERT, INOUT);
    const shift = (pillW + GAP) * ins;
    const opX = CARD.padX + shift;
    const rightX = opX + OP + GAP;

    // letter-wipe: the reveal edge moves from letter to letter
    const dur = props.rightDur ?? 45;
    const chars = Array.from(props.right);
    const lp = clamp01((frame + 1 - rightAt) / Math.max(1, dur)) * chars.length;
    const li = Math.min(chars.length, Math.floor(lp));
    const prefixW = (n: number) => (n <= 0 ? 0 : n >= chars.length ? rightW + 2 : textWidth(chars.slice(0, n).join(""), rightStyle) + rSize * 0.1 / 2);
    const reveal = frame < rightAt ? 0 : lerp(prefixW(li), prefixW(li + 1), OUT(lp - li));

    const rightScale = 1 + 0.08 * bumps(frame, frames(ctx, props.pulses), 10);
    const rightOpacity = lerp(1, 0.45, prog(frame, questionAt, 6));
    const strike = prog(frame + 1, strikeAt, 8, OUT);
    const opK = pop(frame - opAt + 1);
    const qK = pop(frame - questionAt + 1);

    return (
      <div style={{
        position: "absolute", left: CARD.x0, top, width: CARD.x1 - CARD.x0, height: CARD.h, borderRadius: CARD.radius,
        background: C.cardFill, overflow: "hidden", opacity: clamp01(kin), transform: `scale(${lerp(0.9, 1, kin)})`,
        transformOrigin: "50% 50%",
      }}>
        <Border radius={CARD.radius} />
        <Txt x={CARD.padX} capCenter={ROW1} size={leftSize} tracking={0.1} caps>{props.left}</Txt>

        {/* qualifier pill: opens from its left edge */}
        {frame >= qualAt ? (
          <div style={{
            position: "absolute", left: CARD.padX, top: ROW2 - PILL.h / 2, width: pillW * ins, height: PILL.h,
            borderRadius: PILL.h / 2, background: C.graphite, overflow: "hidden", opacity: clamp01(ins * 3),
          }}>
            <Border radius={PILL.h / 2} />
            <div style={{
              position: "absolute", left: PILL.pad, top: (PILL.h - PILL.dot) / 2, width: PILL.dot, height: PILL.dot,
              borderRadius: PILL.dot / 2, background: C.accent,
            }} />
            <Txt x={PILL.pad + PILL.dot + PILL.gap} capCenter={PILL.h / 2} size={PILL.size} tracking={PILL.tracking} caps>
              {props.qualifier.text}
            </Txt>
          </div>
        ) : null}

        {/* operator "=" and its strike */}
        {frame >= opAt ? (
          <svg width={OP} height={OP} viewBox="0 0 44 44" style={{
            position: "absolute", left: opX, top: ROW2 - OP / 2, overflow: "visible", transform: `scale(${opK})`, transformOrigin: "50% 50%",
          }}>
            <path d="M 8 16 H 36 M 8 28 H 36" stroke={C.white} strokeWidth={4} strokeLinecap="round" fill="none" />
            {strike > 0 ? (
              <path d="M 12 38 L 32 6" stroke={C.accent} strokeWidth={4} strokeLinecap="round" fill="none"
                pathLength={1} strokeDasharray={1} strokeDashoffset={1 - strike} />
            ) : null}
          </svg>
        ) : null}

        {/* right term (letter-wipe) */}
        <div style={{
          position: "absolute", left: rightX, top: ROW2 - 30, width: reveal, height: 60, overflow: "hidden", opacity: rightOpacity,
          transform: `scale(${rightScale})`, transformOrigin: "0% 50%",
        }}>
          <Txt x={0} capCenter={30} size={rSize} tracking={0.1} caps>{props.right}</Txt>
        </div>

        {/* "?" */}
        {frame >= questionAt ? (
          <div style={{
            position: "absolute", left: rightX + rightW + qGap, top: ROW2 - 30, width: 40, height: 60,
            transform: `scale(${qK})`, transformOrigin: "20% 50%",
          }}>
            <Txt x={0} capCenter={30} size={rSize} color={C.accent}>?</Txt>
          </div>
        ) : null}
      </div>
    );
  },
});
