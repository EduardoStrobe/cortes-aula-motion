// AnswerField — SYSTEM 8.23 (c6). OWNER: screen-group element author.
// Dashed 1 px text2 pill 420x72 (radius 36) with a 2 px accent caret at its left padding (28 px). No text inside:
// it is the viewer's empty answer. Docked like a card: TL / TR top = stageTop + 16; BL / BR bottom = stageBottom - 16
// (it rides the stage's bottom edge up in the closing).
//   in      the dashed outline draws clockwise from the left end in 10 f (OUT); the caret appears when it closes
//   caret   2 x 36 px, blinks with a 15 f period (8 f on, 7 f off) from then on, through the closing hold
//   out     engine fade (6 f); defaultUntil "end" (list the beat in closing.keep to hold it to the last frame)
// Optional `w` / `h` change the pill size (defaults 420 / 72).
import { C, defineElement, OUT, prog, type Dock } from "../api";
import { dockBox } from "./shared";

export interface AnswerFieldProps {
  dock: Dock;
  /** [screen group] pill width / height in screen px (defaults 420 / 72) */
  w?: number;
  h?: number;
}

const DRAW = 10;
const BLINK = 15;

export const AnswerField = defineElement<AnswerFieldProps>({
  defaultUntil: "end",

  Screen: ({ ctx }) => {
    const { props, frame, at, age } = ctx;
    if (age < 0) return null;
    const w = props.w ?? 420;
    const h = props.h ?? 72;
    const { left, top } = dockBox(ctx, props.dock, w, h);
    const r = h / 2;
    const drawn = prog(frame + 1, at, DRAW, OUT);
    // stadium outline, clockwise, starting at the middle of the left cap (0.5 px inset so the 1 px line is crisp)
    const i = 0.5;
    const d = `M ${i} ${r} A ${r - i} ${r - i} 0 0 1 ${r} ${i} H ${w - r} A ${r - i} ${r - i} 0 0 1 ${w - r} ${h - i} H ${r} A ${r - i} ${r - i} 0 0 1 ${i} ${r} Z`;
    const id = `af-${ctx.beat.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const t = frame - (at + DRAW);
    const caretOn = t >= 0 && (t % BLINK) < 8;
    const ch = Math.min(36, h - 24);
    return (
      <div style={{ position: "absolute", left, top, width: w, height: h }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            <mask id={id} maskUnits="userSpaceOnUse" x={-4} y={-4} width={w + 8} height={h + 8}>
              <path d={d} fill="none" stroke={C.white} strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - drawn} />
            </mask>
          </defs>
          <path d={d} fill="none" stroke={C.text2} strokeWidth={1} strokeDasharray="8 6" mask={`url(#${id})`} />
        </svg>
        <div style={{
          position: "absolute", left: 28, top: (h - ch) / 2, width: 2, height: ch, borderRadius: 1, background: C.accent,
          opacity: caretOn ? 1 : 0,
        }} />
      </div>
    );
  },
});
