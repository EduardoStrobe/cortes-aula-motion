// c6 — cut module. OWNER: the c6 cut author.
//
// Prop = SkinFold (SYSTEM 8.22): three stacked wavy crease strokes, 2 px white, the middle one accent, no fill.
// Everything is drawn in a 0..1 box and every deformation is applied to the POINTS (never to a group transform),
// so the strokes stay exactly 2 px in every state and at every size (token 84 / 48 px, card 150-200 px, film >= 130).
//
// The drawing: each crease is the fold line UNDER a roll of skin, a shallow sagging stroke with a slow ripple
// running through it (so it reads as a soft crease, not as a "water" glyph). `multiply` lets each crease swell
// into the roll it belongs to: the top one closes into a full soft roll, the two below it become the visible part
// of a roll tucked under the one above (hidden-line drawing: the outline stops where the upper roll covers it).
// The result is one stack of three soft rolls.
//
// Moves (unknown names are ignored):
//   draw      14 f: the three creases draw left -> right, 8 f each, 3 f stagger (top, middle, bottom).
//             When the instance has an `appear` frame and a `draw` move, nothing is drawn before that move.
//   squish    10 f: scaleY 1 -> 0.7 -> 1 around the box centre, with a 7 % sideways bulge (the stack is pressed
//             and springs back). Works in both states.
//   multiply  crease -> roll, 5 f stagger top -> bottom, POP (overshoot <= 4 %). The state stays until the
//             instance goes away or an `unroll` starts. args.stagger overrides the 5 f.
//   unroll    [review] roll -> crease again, 8 f per fold, 2 f stagger (only after a multiply; used by the hook
//             token, which swells on a word and must be back to plain creases before it flies to the HUD).
//   Idle      always on and small: a ripple travels along the creases (one wave per 64 f, about 3 px at 150 px) and
//             the stack breathes by 3 %; the rolls swell and settle by 3.5 % one after the other (44 f).
//
// placement "film" adds a 4 px dim(0.5) under-stroke (legibility over bright bone, same idea as the marks on film).
//
// Extra element of this cut: `FoldCard` (below) = the PropCard look (SYSTEM 8.21) with two additions the c6
// storyboard needs: the label strip only opens when the first label arrives, and the card can GROW on a word.
import {
  activeMove, bump, C, clamp01, defineElement, dim, INOUT, lerp, moveSpecs, OUT, pop, prog, PropSvg, textWidth, Txt,
  type Anchor, type Dock, type ElementDef, type MoveSpec, type PropComponent, type PropMove,
} from "../elements/api";

const N = 44; // points per stroke (per half loop for the closed roll)
const TAU = Math.PI * 2;

/** crease i: a sagging stroke (ends 0.55 sag above the middle) + a small travelling ripple */
const CREASES = [
  { y: 0.27, x0: 0.15, x1: 0.85, sag: 0.1, amp: 0.016, waves: 1.0, phase: 0.1 },
  { y: 0.51, x0: 0.07, x1: 0.93, sag: 0.11, amp: 0.018, waves: 1.0, phase: 0.55 },
  { y: 0.75, x0: 0.11, x1: 0.89, sag: 0.1, amp: 0.016, waves: 1.0, phase: 0.3 },
] as const;
/** roll i: superellipse; consecutive rolls overlap, the lower one is drawn only where the upper does not cover it */
const ROLLS = [
  { cx: 0.492, cy: 0.25, w: 0.76, h: 0.31 },
  { cx: 0.5, cy: 0.49, w: 0.92, h: 0.33 },
  { cx: 0.512, cy: 0.73, w: 0.84, h: 0.33 },
] as const;
const ACCENT_INDEX = 1;
const EXP = 2.4;
const SUPER = 2 / EXP;

type P2 = [number, number];
type Swell = [number, number]; // width factor, height factor

const creasePoint = (i: number, u: number, ripple: number, gapK: number): P2 => {
  const c = CREASES[i];
  // the ripple calms down towards both ends (a crease fades out, it does not stop mid-swing)
  const taper = Math.sin(Math.PI * clamp01(u));
  const y = 0.5 + (c.y - 0.5) * gapK + c.sag * (4 * u * (1 - u) - 0.55) + c.amp * taper * Math.sin(TAU * (c.waves * u + c.phase - ripple));
  return [lerp(c.x0, c.x1, u), y];
};
/** th: 0 = right, PI/2 = bottom, PI = left, 3PI/2 = top (y grows downwards) */
const rollPoint = (i: number, th: number, sw: Swell): P2 => {
  const r = ROLLS[i];
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  return [
    r.cx + r.w * sw[0] * 0.5 * Math.sign(cs) * Math.pow(Math.abs(cs), SUPER),
    r.cy + r.h * sw[1] * 0.5 * Math.sign(sn) * Math.pow(Math.abs(sn), SUPER),
  ];
};
const insideRoll = (i: number, p: P2, sw: Swell): boolean => {
  const r = ROLLS[i];
  const a = Math.abs((p[0] - r.cx) / (r.w * sw[0] * 0.5));
  const b = Math.abs((p[1] - r.cy) / (r.h * sw[1] * 0.5));
  return Math.pow(a, EXP) + Math.pow(b, EXP) < 1;
};
/** The arc of roll i (i >= 1) that roll i - 1 does not hide: it runs from thL through the bottom (PI/2) to thR. */
const visibleArc = (i: number, sw: Swell[]): [number, number] => {
  const walk = (sign: 1 | -1): number => {
    const step = Math.PI / 240;
    let th = Math.PI / 2;
    for (let k = 0; k < 240; k++) {
      const next = th + sign * step;
      if (insideRoll(i - 1, rollPoint(i, next, sw[i]), sw[i - 1])) return th;
      th = next;
    }
    return th;
  };
  return [walk(1), walk(-1)];
};

const fmt = (v: number) => v.toFixed(4);
const pathOf = (pts: P2[], closed: boolean) =>
  pts.map((p, k) => `${k === 0 ? "M" : "L"} ${fmt(p[0])} ${fmt(p[1])}`).join(" ") + (closed ? " Z" : "");

const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

interface FoldState {
  /** 0..1 per crease: how much of the stroke is drawn */
  drawn: [number, number, number];
  /** 0..~1.04 per crease: crease -> roll */
  roll: [number, number, number];
  /** 0..1 squish bump */
  squish: number;
}

const stateAt = (moves: PropMove[], frame: number, appear: number | undefined): FoldState => {
  // draw
  const dm = activeMove(moves, frame, ["draw"]);
  const hasDraw = moves.some((m) => m.name === "draw");
  const drawn: [number, number, number] = [1, 1, 1];
  if (dm) {
    const k = (dm.move.dur ?? 14) / 14;
    for (let i = 0; i < 3; i++) drawn[i] = easeOutCubic((dm.t + 1 - i * 3 * k) / (8 * k));
  } else if (hasDraw && appear !== undefined) {
    drawn[0] = drawn[1] = drawn[2] = 0;
  }
  // multiply
  const mm = activeMove(moves, frame, ["multiply", "unroll"]);
  const roll: [number, number, number] = [0, 0, 0];
  if (mm && mm.move.name === "multiply") {
    const st = typeof mm.move.args?.stagger === "number" ? (mm.move.args.stagger as number) : 5;
    for (let i = 0; i < 3; i++) roll[i] = pop(mm.t + 1 - i * st);
  } else if (mm && moves.some((m) => m.name === "multiply" && m.at < mm.move.at)) {
    for (let i = 0; i < 3; i++) roll[i] = 1 - easeOutCubic((mm.t + 1 - i * 2) / 8);
  }
  // squish (largest running bump)
  let squish = 0;
  for (const m of moves) if (m.name === "squish") squish = Math.max(squish, bump(frame, m.at, m.dur ?? 10));
  return { drawn, roll, squish };
};

export const Prop: PropComponent = ({ size, placement, frame, moves, appear, color: inkColor, accent: inkAccent }) => {
  const color = inkColor ?? C.white;
  const accent = inkAccent ?? C.accent;
  // [looks] A look hands the page token its ink (`color` is only ever passed then). Dark strokes on a light page
  // read thinner than the same white strokes on graphite, and in "azul-bebe" the hook token is 220 px beside a
  // 96 px headline: the stroke goes from 2 px (up to the 84 px kicker size, i.e. the HUD token is untouched) to
  // 3 px at 200 px and above, continuously, so it thins out while the token flies to the HUD. Without an ink
  // (default look, cards, film) it is the 2 px of SYSTEM 8.22, as approved.
  const lineW = placement === "token" && inkColor !== undefined ? 2 + clamp01((size - 84) / 116) : 2;
  const st = stateAt(moves, frame, appear);
  const sy = 1 - 0.3 * st.squish;
  const sx = 1 + 0.07 * st.squish;
  const squashPt = (p: P2): P2 => [0.5 + (p[0] - 0.5) * sx, 0.5 + (p[1] - 0.5) * sy];
  // idle
  const ripple = frame / 64;
  const gapK = 1 + 0.03 * Math.sin((TAU * frame) / 50);
  const sw: Swell[] = [0, 1, 2].map((i) => {
    const s = Math.sin((TAU * frame) / 44 - i * 0.9);
    return [1 + 0.035 * s, 1 - 0.025 * s] as Swell;
  });

  return (
    <PropSvg size={size}>
      {(strokeW) => CREASES.map((_, i) => {
        const d = st.drawn[i];
        if (d <= 0) return null;
        const m = st.roll[i];
        let pts: P2[] = [];
        let closed = false;
        if (i === 0) {
          // the top fold closes into a whole roll: the stroke splits into the roll's top and bottom halves
          const top: P2[] = [];
          const bot: P2[] = [];
          for (let k = 0; k <= N; k++) {
            const u = k / N;
            const a = creasePoint(i, u, ripple, gapK);
            if (m <= 0) {
              top.push(a);
              continue;
            }
            const bt = rollPoint(i, Math.PI + Math.PI * u, sw[i]);
            const bb = rollPoint(i, Math.PI - Math.PI * u, sw[i]);
            top.push([lerp(a[0], bt[0], m), lerp(a[1], bt[1], m)]);
            bot.push([lerp(a[0], bb[0], m), lerp(a[1], bb[1], m)]);
          }
          closed = m > 0.0005;
          pts = closed ? [...top, ...bot.reverse()] : top;
        } else {
          // the folds below become the part of their roll that shows under the roll above
          const arc = m > 0 ? visibleArc(i, sw) : null;
          for (let k = 0; k <= N; k++) {
            const u = k / N;
            const a = creasePoint(i, u, ripple, gapK);
            if (!arc) {
              pts.push(a);
              continue;
            }
            const b = rollPoint(i, lerp(arc[0], arc[1], u), sw[i]);
            pts.push([lerp(a[0], b[0], m), lerp(a[1], b[1], m)]);
          }
          // while this fold is still on its way, its ends may lie behind the roll above: hide them (hidden line)
          if (arc && st.roll[i - 1] > 0.6) {
            const hidden = (p: P2) => insideRoll(i - 1, p, [sw[i - 1][0] * 0.99, sw[i - 1][1] * 0.99]);
            let a0 = 0;
            let a1 = pts.length - 1;
            while (a0 < a1 - 2 && hidden(pts[a0])) a0++;
            while (a1 > a0 + 2 && hidden(pts[a1])) a1--;
            pts = pts.slice(a0, a1 + 1);
          }
        }
        const path = pathOf(pts.map(squashPt), closed);
        const dash = d < 1 ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - d } : {};
        return (
          <g key={i}>
            {placement === "film" ? <path d={path} stroke={dim(0.5)} strokeWidth={strokeW(4)} {...dash} /> : null}
            <path d={path} stroke={i === ACCENT_INDEX ? accent : color} strokeWidth={strokeW(lineW)} {...dash} />
          </g>
        );
      })}
    </PropSvg>
  );
};

// ---------------------------------------------------------------------------------------------------------------
// FoldCard — the PropCard of SYSTEM 8.21 (graphite2, 1 px line border, radius 20, the cut's Prop inside), with:
//   labels   [{ at, text }]: the label strip is CLOSED until the first label arrives; it then opens (6 f OUT) while
//            the text fades in; later labels roll (6 f OUT). A label wider than the card goes on two balanced
//            lines and the strip grows to fit them (same rule as PropCard).
//   grow     { at, size, propSize }: on that word the card and the Prop inside it swell (POP, 8 f) from
//            `size`/`propSize` to the given values, anchored on its dock corner.
//   moves    resolved and handed to the Prop untouched; the Prop gets `appear` = the card's frame.
//   hero     [review: "o radiograma fica parado 10 s e a unica animacao e um cartao pequeno no canto"; client:
//            "quando ele falar de X, traga animacao"] [{ at, until, side?, dim? }]: between the two anchors the
//            card leaves its dock and sits BIG in the middle of the stage (longer side about `side` px, default
//            430; a CSS scale, so strokes and label grow with it) over a dim(`dim`, default 0.5) stage. It
//            travels there in 12 f and back in 14 f (INOUT); a window that starts on the beat's own frame pops
//            in directly in the middle (the engine's hero entrance, shared.heroEntrance, for a cut-specific card).
//            c6: on "dobras" (the thing he names) and again for the whole sentence about them
//            passage, where the lesson shows a third-party baby photo that this cut never shows.
//   in       scale 0 -> 1, 8 f POP + "pop" cue (`sound: false` silences it).   out: engine fade (6 f).
// Docks as PropCard: TL / TR top = stageTop + 16; BL / BR bottom = stageBottom - 16; {x, y} = left / top.
interface FoldCardProps {
  dock: Dock;
  size?: number;
  propSize?: number;
  labels?: { at: Anchor; text: string }[];
  grow?: { at: Anchor; size: number; propSize: number };
  hero?: { at: Anchor; until: Anchor; side?: number; dim?: number }[];
  moves?: MoveSpec[];
  sound?: boolean;
}

const LBL = { size: 24, tracking: 0.14 };
const STRIP = 40;

interface LabelLayout { lines: string[]; size: number; h: number }
const layoutLabel = (text: string, avail: number): LabelLayout => {
  const w = (t: string, size: number) => textWidth(t, { size, tracking: LBL.tracking, caps: true });
  if (!text) return { lines: [], size: LBL.size, h: 0 };
  for (let size = LBL.size; size >= 22; size--) if (w(text, size) <= avail) return { lines: [text], size, h: STRIP };
  const words = text.split(" ");
  if (words.length < 2) return { lines: [text], size: Math.max(16, Math.floor((LBL.size * avail) / w(text, LBL.size))), h: STRIP };
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
  return { lines: best, size, h: 16 + (size + 6) + size + 4 };
};

const FoldCard = defineElement<FoldCardProps>({
  defaultUntil: "closing",
  cues: (beat) => (beat.props.sound === false ? [] : [{ f: beat.at, cue: "pop" }]),

  Screen: ({ ctx }) => {
    const { props, frame, at, age } = ctx;
    if (age < 0) return null;
    const size0 = props.size ?? 180;
    const prop0 = props.propSize ?? 150;
    const growAt = props.grow ? Math.max(at, ctx.fr(props.grow.at)) : Infinity;
    const g = props.grow && frame >= growAt ? pop(frame + 1 - growAt) : 0;
    const size = props.grow ? lerp(size0, props.grow.size, g) : size0;
    const propSize = props.grow ? lerp(prop0, props.grow.propSize, g) : prop0;
    // labels are laid out for the width the card is heading to
    const avail = (props.grow && frame >= growAt ? props.grow.size : size0) - 28;

    const evs = (props.labels ?? []).map((l) => ({ f: Math.max(at, ctx.fr(l.at)), text: l.text })).sort((a, b) => a.f - b.f);
    let i = -1;
    for (let j = 0; j < evs.length; j++) if (evs[j].f <= frame) i = j;
    const cur = i >= 0 ? layoutLabel(evs[i].text, avail) : null;
    const prev = i > 0 ? layoutLabel(evs[i - 1].text, avail) : null;
    const t = i >= 0 ? prog(frame + 1, evs[i].f, 6, OUT) : 0;
    const stripH = cur ? lerp(prev ? prev.h : 0, cur.h, t) : 0;

    const h = size + stripH;
    const d = ctx.dock(props.dock);
    const left = d.align === "right" ? d.x - size : d.x;
    const top = typeof props.dock === "object" || props.dock === "TL" || props.dock === "TR" ? d.y : d.bottom - h;
    const moves = moveSpecs(props.moves, ctx.fr);
    const P = ctx.Prop;

    // hero windows: k = 0 docked, 1 centred and big
    let k = 0;
    let side = 430;
    let dimLevel = 0.5;
    if (ctx.pane === null) {
      for (const hw of props.hero ?? []) {
        const a = Math.max(at, ctx.fr(hw.at));
        if (frame < a) continue;
        const kin = a === at ? 1 : prog(frame, a, 12, INOUT);
        const kk = Math.min(kin, 1 - prog(frame, ctx.fr(hw.until), 14, INOUT));
        if (kk > k) {
          k = kk;
          side = hw.side ?? 430;
          dimLevel = hw.dim ?? 0.5;
        }
      }
    }
    const st = ctx.stage;
    const s0 = Math.max(1, Math.min(side / Math.max(size, h), (st.h - 60) / h, (st.w - 60) / size));
    const hx = (st.cx - (left + size / 2)) * k;
    const hy = (st.cy - (top + h / 2)) * k;
    const hs = lerp(1, s0, k);
    const heroDim = dimLevel * k * clamp01((age + 1) / 4);

    const labelBlock = (l: LabelLayout, dy: number, opacity: number) => {
      const pitch = l.size + 6;
      const c0 = l.h / 2 - ((l.lines.length - 1) * pitch) / 2 - 2;
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

    return (
      <>
      {heroDim > 0 ? (
        <div style={{ position: "absolute", left: st.left, top: st.top, width: st.w, height: st.h, background: dim(heroDim) }} />
      ) : null}
      <div style={{
        position: "absolute", left, top, width: size, height: h, borderRadius: 20, background: C.graphite2, overflow: "hidden",
        transform: `translate(${hx}px, ${hy}px) scale(${pop(age + 1) * hs})`, transformOrigin: "50% 50%",
      }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 20, border: `1px solid ${C.line}`, boxSizing: "border-box", pointerEvents: "none",
        }} />
        <div style={{ position: "absolute", left: (size - propSize) / 2, top: (size - propSize) / 2, width: propSize, height: propSize }}>
          <P size={propSize} placement="card" frame={frame} moves={moves} appear={at} />
        </div>
        {cur ? (
          <div style={{ position: "absolute", left: 0, top: size, width: size, height: stripH, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 16, top: 0, width: size - 32, height: 1, background: C.line }} />
            {prev && t < 1 ? labelBlock(prev, -stripH * t, 1) : null}
            {prev ? labelBlock(cur, stripH * (1 - t), 1) : labelBlock(cur, 0, clamp01((frame + 1 - evs[i].f) / 6))}
          </div>
        ) : null}
      </div>
      </>
    );
  },
});

// ---------------------------------------------------------------------------------------------------------------
// FieldBack — a dim(0.6) pill (the token used for dims over the film) of the AnswerField's size on the same dock. The AnswerField of
// SYSTEM 8.23 is only a 1 px dashed outline; over the radiograph it nearly disappears at phone size. This beat is
// listed right BEFORE the AnswerField beat, so the dashed outline and the caret are drawn on top of it.
// Fades in over the 10 f the outline takes to draw; exit: engine fade (keep it with closing.keep).
// [review round 1] NOT used by c6.json any more: field + back read as a redaction bar over the film, so the closing
// now leaves the dimmed film with the lit trace and the pointer ring as the open spot. Kept for reference only.
const FieldBack = defineElement<{ dock: Dock; w?: number; h?: number }>({
  defaultUntil: "end",
  Screen: ({ ctx }) => {
    const { props, frame, at, age } = ctx;
    if (age < 0) return null;
    const w = props.w ?? 420;
    const h = props.h ?? 72;
    const d = ctx.dock(props.dock);
    const left = d.align === "right" ? d.x - w : d.x;
    const top = typeof props.dock === "object" || props.dock === "TL" || props.dock === "TR" ? d.y : d.bottom - h;
    return (
      <div style={{
        position: "absolute", left, top, width: w, height: h, borderRadius: h / 2, background: dim(0.6),
        opacity: prog(frame + 1, at, 10, OUT),
      }} />
    );
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const elements: Record<string, ElementDef<any>> = { FoldCard, FieldBack };
