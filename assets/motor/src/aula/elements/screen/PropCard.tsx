// PropCard — SYSTEM 8.21. OWNER: screen-group element author.
// Inset card (graphite2, opaque, 1 px line border, radius 20), `size` x `size` (180), holding the cut's Prop
// (ctx.Prop, placement "card") in a `propSize` box (132; c5 150) centred in the square. With a label strip the card
// is size x (size + 36): a 1 px line divider and the label (24 px caps +0.14em, text2) centred in the strip.
// Docks: TL / TR top = stageTop + 16; BL / BR bottom = stageBottom - 16; {x, y} = left / top. It rides the edges.
//   in      scale 0 -> 1, 8 f POP (origin: card centre) + "pop" cue (prop landing; `sound: false` silences it)
//   out     engine fade (6 f)
//   label   fades in (6 f) on `labelAt` (default: with the card); `rolls` = 6 f vertical roll (OUT)
//   moves   resolved and handed to the Prop untouched; the Prop gets `appear` = the card's frame
//
// Beyond the SYSTEM text:
//   label fit   a label wider than the strip (size - 24 px) first shrinks to 20 px; if it still does not fit it is
//               set on TWO balanced lines (<= 24 px, floor 18 px, pitch size + 6) and the strip grows from 36 px to
//               fit them (6 f, with the roll). Top docks grow downwards, bottom docks upwards. c6 needs this:
//               `RUINS DE RAIO X` is about 290 px wide at 24 px and the card is 180 px.
//   sound       optional `sound: false`.
//   hero        HERO ENTRANCE (shared.heroEntrance): the card pops big in the middle of the dimmed stage on its
//               word, holds 20 f, then flies (14 f) to its dock. `hero: false` = straight to the dock (old look).
import {
  C, clamp01, defineElement, lerp, moveSpecs, OUT, pop, prog, textWidth, Txt, type Anchor, type Dock, type MoveSpec,
} from "../api";
import { Border, dockBox, heroEntrance, HeroDim } from "./shared";

export interface PropCardProps {
  dock: Dock;
  /** card width (default 180) */
  size?: number;
  /** side of the Prop box inside the card (default 132; c5 uses 150) */
  propSize?: number;
  /** true/string = the card has a label strip (180x216). A string is the first label text; "" or true = empty strip */
  label?: string | boolean;
  /** the label text fades in on this anchor (default: with the card) */
  labelAt?: Anchor;
  /** label rolls (6 f vertical roll) */
  rolls?: { at: Anchor; text: string }[];
  /** named moves of the Prop inside the card (SYSTEM 8.22 table) */
  moves?: MoveSpec[];
  /** [screen group] false = no "pop" cue when the card lands */
  sound?: boolean;
  /** [engine] false = no hero entrance (default true, see shared.heroEntrance) */
  hero?: boolean;
}

const STRIP = 36;
const LBL = { size: 24, tracking: 0.14 };

interface LabelLayout { lines: string[]; size: number; h: number }
const layoutLabel = (text: string, avail: number): LabelLayout => {
  const w = (t: string, size: number) => textWidth(t, { size, tracking: LBL.tracking, caps: true });
  if (!text) return { lines: [], size: LBL.size, h: STRIP };
  for (let size = LBL.size; size >= 20; size--) if (w(text, size) <= avail) return { lines: [text], size, h: STRIP };
  const words = text.split(" ");
  if (words.length < 2) return { lines: [text], size: Math.max(14, Math.floor((LBL.size * avail) / w(text, LBL.size))), h: STRIP };
  let best: [string, string] = [words[0], words.slice(1).join(" ")];
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const m = Math.max(w(a, LBL.size), w(b, LBL.size));
    if (m < bestW) {
      bestW = m;
      best = [a, b];
    }
  }
  const size = Math.max(18, Math.min(LBL.size, Math.floor((LBL.size * avail) / bestW)));
  return { lines: best, size, h: 14 + (size + 6) + size + 4 };
};

export const PropCard = defineElement<PropCardProps>({
  defaultUntil: "closing",
  cues: (beat) => (beat.props.sound === false ? [] : [{ f: beat.at, cue: "pop" }]),

  Screen: ({ ctx }) => {
    const { props, frame, at, age } = ctx;
    if (age < 0) return null;
    const size = props.size ?? 180;
    const propSize = props.propSize ?? 132;
    const hasStrip = props.label !== undefined && props.label !== false;
    const avail = size - 24;

    // label timeline
    const first = typeof props.label === "string" ? props.label : "";
    const labelAt = props.labelAt ? Math.max(at, ctx.fr(props.labelAt)) : at;
    const evs = [{ f: first ? labelAt : at, text: first }, ...(props.rolls ?? []).map((r) => ({ f: Math.max(at, ctx.fr(r.at)), text: r.text }))]
      .sort((a, b) => a.f - b.f);
    let i = 0;
    for (let j = 0; j < evs.length; j++) if (evs[j].f <= frame) i = j;
    const cur = layoutLabel(frame >= evs[i].f ? evs[i].text : "", avail);
    const prev = i > 0 ? layoutLabel(evs[i - 1].text, avail) : null;
    const t = i > 0 ? prog(frame + 1, evs[i].f, 6, OUT) : first ? prog(frame + 1, labelAt, 6) : 1;
    const stripH = hasStrip ? (prev ? lerp(prev.h, cur.h, t) : cur.h) : 0;

    const h = size + stripH;
    const { left, top } = dockBox(ctx, props.dock, size, h);
    const moves = moveSpecs(props.moves, ctx.fr);
    const P = ctx.Prop;

    const labelBlock = (l: LabelLayout, dy: number, opacity: number) => {
      const pitch = l.size + 6;
      const c0 = l.h / 2 - ((l.lines.length - 1) * pitch) / 2 - 1;
      return (
        <div style={{ position: "absolute", left: 0, top: 0, width: size, height: l.h, transform: `translateY(${dy}px)`, opacity }}>
          {l.lines.map((line, k) => (
            <div key={k} style={{ position: "absolute", left: 0, top: 0, width: size, height: l.h }}>
              <Txt cx={size / 2} capCenter={c0 + k * pitch} size={l.size} tracking={LBL.tracking} caps color={C.text2}>{line}</Txt>
            </div>
          ))}
        </div>
      );
    };

    const hero = heroEntrance(ctx, { left, top, w: size, h }, props.hero !== false);
    return (
      <>
      <HeroDim ctx={ctx} level={hero.dim} />
      <div style={{
        position: "absolute", left, top, width: size, height: h, borderRadius: 20, background: C.graphite2, overflow: "hidden",
        transform: `translate(${hero.dx}px, ${hero.dy}px) scale(${pop(age + 1) * hero.scale})`, transformOrigin: "50% 50%",
      }}>
        <Border radius={20} />
        <div style={{ position: "absolute", left: (size - propSize) / 2, top: (size - propSize) / 2, width: propSize, height: propSize }}>
          <P size={propSize} placement="card" frame={frame} moves={moves} appear={at} />
        </div>
        {hasStrip ? (
          <div style={{ position: "absolute", left: 0, top: size, width: size, height: stripH, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 16, top: 0, width: size - 32, height: 1, background: C.line }} />
            {prev && t < 1 ? labelBlock(prev, -stripH * t, 1) : null}
            {i > 0 ? labelBlock(cur, stripH * (1 - t), 1) : labelBlock(cur, 0, clamp01(t))}
          </div>
        ) : null}
      </div>
      </>
    );
  },
});
