// Chip — SYSTEM 8.9. OWNER: screen-group element author.
// Pill h 64 (tokens.CHIP_H), radius 32, cardFill, 1 px line border, padding 0 22; 14 px accent dot, 12 px gap, text
// 32 px caps +0.12em (tokens.CHIP_SIZE). HTML in SCREEN space: its size never changes with the camera; only the pin
// + leader follow the slide.
// REVIEW (phone legibility): the SYSTEM sizes (56 / 28 px, 20 px glyph) were about 10 pt on a phone. A chip whose
// widest text would pass x 960 at 32 px shrinks its type down to the old 28 px (rows: down to 22 px, as before),
// so every chip that fitted before still fits. Body chips ({x, y}) stay CENTRED on the old 56 px box (top - 4).
// The glyph is a 40 px round badge: check = 3.5 px white check in a white-ringed badge, "?" = graphite on an accent
// disc; the flip pulses the whole chip (x 1.06).
//
// Motion (SYSTEM 6):
//   in      pin ring opacity 0 -> 1 (4 f); leader draws (6 f); pill scale 0.9 -> 1 + opacity (8 f POP); dot 1 -> 1.5 -> 1 (8 f)
//   roll    old text translateY 0 -> -100 %, new 100 % -> 0, width animates (6 f OUT)
//   build   same 6 f OUT width animation; when the new text starts with the old one the text stays put and is
//           revealed by the growing pill (otherwise it rolls)
//   out     "fade": opacity 1 -> 0, translateY 0 -> -8 over the 6 frames after `until`
//           "compact": 12 f INOUT slide up-left + fade. The engine unmounts a beat 6 f after `until`, so the 12
//           frames are CENTRED on `until` (until - 6 .. until + 6; the fast middle of the INOUT falls on the word).
//
// Things the SYSTEM text does not define and this file does (all optional):
//   tick            true = "tick" cue on the chip's frame; Anchor[] = on those frames (c4 check marks, c1 roll);
//                   false = silent. Default (SYSTEM 11, "first chip of a series"): the chip that OPENS a row
//                   ticks, every other chip is silent.
//   glyph question  without an earlier check (c2 `chipCadê`): the accent "?" pops in (8 f POP). A "?" always
//                   breathes (scale 1 -> 1.08 -> 1, 30 f) so the open question stays alive.
//   rolls / build   also pulse the dot (1 -> 1.5 -> 1, 8 f), like the chip-in.
//   pinAt           pin + leader appear later (c1 f 196). Then the leader grows from the pill to the pin;
//                   when it appears with the chip it grows from the pin to the pill.
//   body / dock {x,y}  the pill is kept inside the CURRENT stage rect (top >= stageTop + 16, bottom <=
//                   stageBottom - 16, text end <= x 960): a kept body chip rides the edges in the closing.
//   protect         enforced by construction: while the pill is over the protect rect (6 px margin) at the current
//                   camera it is pushed up or down (towards the nearer side that stays inside the stage) until it
//                   clears the rect; the push ramps in over a 32 px band beside the rect, so nothing jumps.
//   row             chips of the same dock (and pane) with row: true whose lifetimes overlap form a row. A chip's
//                   slot = the chips of its row that entered before it (current widths + 12 px gaps); slots never
//                   reflow when an earlier chip leaves. Right docks (TR/BR) flow right to left. If the settled
//                   row would put text beyond x 960 the row tightens (padding 22 -> 14, gap 12 -> 8, then type
//                   28 -> 22 px); if it still does not fit the chip throws.
import React from "react";
import {
  bump, bumps, C, CHIP_H, CHIP_SIZE, clamp01, defineElement, dim, frames, INOUT, lerp, OUT, pop, prog, textWidth, Txt,
  type Anchor, type Dock, type ElCtx, type Pt, type Rect, type Resolved, type ResolvedBeat,
} from "../api";
import { Border, CanvasSvg } from "./shared";

export interface ChipProps {
  /** first text shown (without the dot; the dot is drawn by the chip) */
  text: string;
  /** where the pill sits: a dock of the CURRENT stage rect ... */
  dock?: Dock;
  /** ... or an explicit SCREEN position of the pill's left/top (same as dock {x,y}). Exactly one of dock/body. */
  body?: { x: number; y: number };
  /** slide point: adds the 10 px anchor ring (1.5 px white) and a 1 px text2 leader from the pill's nearest edge;
   *  the pill stays put while the leader follows the camera */
  pin?: Pt;
  /** the pin + leader only appear on this anchor (default: with the chip; leader draws in 6 f) */
  pinAt?: Anchor;
  /** chips sharing a dock with row: true flow left to right with a 12 px gap, in beat order */
  row?: boolean;
  /** text rolls (6 f, OUT; width animates) */
  rolls?: { at: Anchor; text: string }[];
  /** the chip appears with `text` and grows to these (full) texts on later words */
  build?: { at: Anchor; text: string }[];
  /** check = 20 px check mark drawn in 8 f after the text; question = flips (rotateX, 8 f) into an accent "?";
   *  wobble = the current glyph rotates +-8 deg (10 f) */
  glyph?: { at: Anchor; kind: "check" | "question" | "wobble" }[];
  /** slide rect the pill must never cover (the structure under discussion) */
  protect?: Rect;
  /** dot pulses (scale 1 -> 1.5 -> 1, 8 f) */
  pulses?: Anchor[];
  /** exit style: "fade" (default: opacity 1 -> 0, translateY 0 -> -8, 6 f) or "compact" (c4 FICHA: slides up-left
   *  towards the HUD and fades, 12 f INOUT) */
  exit?: "fade" | "compact";
  /** [screen group] tick cue: true = on the chip's frame, Anchor[] = on those frames, false = never.
   *  Default: only the chip that opens a row ticks. */
  tick?: boolean | Anchor[];
}

// ---- geometry ----------------------------------------------------------------------------------------------------
const PH = CHIP_H;
const DOT = 14;
const GAP = 12;
const GLYPH = 40;
const GLYPH_GAP = 10;
/** the size every storyboard position was designed for (SYSTEM 8.9) */
const OLD = { h: 56, size: 28 };
const TRACK = 0.12;
const ROLL = 6;
const TEXT_SAFE_RIGHT = 960;

interface Metrics { pad: number; size: number; rowGap: number }
const BASE: Metrics = { pad: 22, size: CHIP_SIZE, rowGap: 12 };

type Fr = (a: Anchor) => number;
interface TextEv { f: number; text: string; kind: "in" | "roll" | "build" }
interface GlyphEv { f: number; kind: "check" | "question" | "wobble" }
interface Timeline { at: number; texts: TextEv[]; glyphs: GlyphEv[]; glyphAt: number | null }

const timelines = new WeakMap<object, Timeline>();
const timelineOf = (beat: ResolvedBeat<ChipProps>, r: Resolved): Timeline => {
  const hit = timelines.get(beat);
  if (hit) return hit;
  const fr: Fr = (a) => r.fr(a, `beat "${beat.id}"`);
  const p = beat.props;
  const texts: TextEv[] = [{ f: beat.at, text: p.text, kind: "in" }];
  for (const b of p.build ?? []) texts.push({ f: Math.max(beat.at, fr(b.at)), text: b.text, kind: "build" });
  for (const b of p.rolls ?? []) texts.push({ f: Math.max(beat.at, fr(b.at)), text: b.text, kind: "roll" });
  texts.sort((a, b) => a.f - b.f);
  const glyphs: GlyphEv[] = (p.glyph ?? []).map((g) => ({ f: Math.max(beat.at, fr(g.at)), kind: g.kind })).sort((a, b) => a.f - b.f);
  const first = glyphs.find((g) => g.kind !== "wobble");
  const tl: Timeline = { at: beat.at, texts, glyphs, glyphAt: first ? first.f : null };
  timelines.set(beat, tl);
  return tl;
};

const tW = (text: string, size: number) => textWidth(text, { size, tracking: TRACK, caps: true });

const textState = (tl: Timeline, frame: number) => {
  let i = 0;
  for (let j = 0; j < tl.texts.length; j++) if (tl.texts[j].f <= frame) i = j;
  const cur = tl.texts[i];
  const prev = i > 0 ? tl.texts[i - 1] : null;
  return { cur, prev, t: prev ? prog(frame, cur.f, ROLL, OUT) : 1 };
};

const glyphWidthAt = (tl: Timeline, frame: number) =>
  tl.glyphAt === null ? 0 : (GLYPH_GAP + GLYPH) * (tl.glyphAt <= tl.at ? 1 : prog(frame, tl.glyphAt, ROLL, OUT));

const textWidthAt = (tl: Timeline, m: Metrics, frame: number) => {
  const { cur, prev, t } = textState(tl, frame);
  return prev ? lerp(tW(prev.text, m.size), tW(cur.text, m.size), t) : tW(cur.text, m.size);
};
const widthAt = (tl: Timeline, m: Metrics, frame: number) => 2 * m.pad + DOT + GAP + textWidthAt(tl, m, frame) + glyphWidthAt(tl, frame);
/** widest state the chip ever takes */
const maxWidth = (tl: Timeline, m: Metrics) =>
  2 * m.pad + DOT + GAP + Math.max(...tl.texts.map((e) => tW(e.text, m.size))) + (tl.glyphAt === null ? 0 : GLYPH_GAP + GLYPH);

// ---- rows --------------------------------------------------------------------------------------------------------
const anchorOf = (p: ChipProps): Dock => p.body ?? p.dock ?? "TL";
const rowKey = (p: ChipProps) => (p.row ? JSON.stringify(anchorOf(p)) : null);

/** The chips of this chip's row (same dock, same pane, overlapping lifetimes), in order of entry. */
const rowOf = (beat: ResolvedBeat<ChipProps>, r: Resolved): ResolvedBeat<ChipProps>[] => {
  const key = rowKey(beat.props);
  if (key === null) return [beat];
  const all = (r.beats as unknown as ResolvedBeat<ChipProps>[])
    .filter((b) => b.def === beat.def && b.pane === beat.pane && rowKey(b.props) === key)
    .sort((a, b) => a.at - b.at || a.index - b.index);
  let cluster: ResolvedBeat<ChipProps>[] = [];
  let end = -Infinity;
  for (const b of all) {
    if (b.at >= end) {
      if (cluster.includes(beat)) break;
      cluster = [];
      end = -Infinity;
    }
    cluster.push(b);
    end = Math.max(end, b.until);
  }
  return cluster.includes(beat) ? cluster : [beat];
};

const rowMetrics = (ctx: ElCtx<ChipProps>, row: ResolvedBeat<ChipProps>[]): Metrics => {
  const anchor = anchorOf(ctx.props);
  const d = ctx.dock(anchor);
  if (row.length < 2 && !ctx.props.row) {
    // single chip: 32 px, shrinking to the old 28 px while its widest text would pass x 960 (left docks / body) or
    // the stage's left edge (right docks)
    const tl = timelineOf(ctx.beat, ctx.r);
    const room = d.align === "right" ? d.x - (ctx.stage.left + 8) : TEXT_SAFE_RIGHT + BASE.pad - d.x;
    for (let size = BASE.size; size > OLD.size; size--) {
      const m = { ...BASE, size };
      if (maxWidth(tl, m) <= room) return m;
    }
    return { ...BASE, size: OLD.size };
  }
  const tls = row.map((b) => timelineOf(b, ctx.r));
  const fits = (m: Metrics) => {
    const total = tls.reduce((s, tl) => s + maxWidth(tl, m), 0) + m.rowGap * (row.length - 1);
    return d.align === "right"
      ? d.x - total >= ctx.stage.left + 8
      : d.x + total <= ctx.stage.right - 8 && d.x + total - m.pad <= TEXT_SAFE_RIGHT;
  };
  if (fits(BASE)) return BASE;
  for (let size = BASE.size; size >= OLD.size; size--) {
    for (const k of [0.25, 0.5, 0.75, 1]) {
      const m = { pad: 22 - 8 * k, size, rowGap: 12 - 4 * k };
      if (fits(m)) return m;
    }
  }
  for (let size = 27; size >= 22; size--) {
    const m = { pad: 14, size, rowGap: 8 };
    if (fits(m)) return m;
  }
  throw new Error(`[aula] Chip "${ctx.beat.id}": the row ${row.map((b) => b.id).join(", ")} does not fit the stage (text would pass x 960)`);
};

/** Pill left/top at this frame: dock or body, row slot, stage clamp, protect. */
const place = (ctx: ElCtx<ChipProps>, row: ResolvedBeat<ChipProps>[], m: Metrics, w: number): { left: number; top: number } => {
  const { props, frame, stage: st } = ctx;
  let offset = 0;
  for (const b of row) {
    if (b === ctx.beat) break;
    offset += widthAt(timelineOf(b, ctx.r), m, Math.min(frame, b.until)) + m.rowGap;
  }
  const anchor = anchorOf(props);
  const maxRight = Math.min(st.right - 8, TEXT_SAFE_RIGHT + m.pad);
  let left: number;
  let top: number;
  if (typeof anchor === "object") {
    left = anchor.x + offset;
    // storyboard y = top of the old 56 px pill: the taller pill stays centred on it
    top = Math.max(st.top + 16, Math.min(st.bottom - 16 - PH, anchor.y - (PH - OLD.h) / 2));
    if (left + w > maxRight) left = maxRight - w;
    if (left < st.left + 8) left = st.left + 8;
  } else {
    const d = ctx.dock(anchor);
    left = d.align === "right" ? d.x - w - offset : d.x + offset;
    top = d.y;
  }
  if (props.protect) {
    // Vertical dodge only, so the motion is continuous: the push is the full vertical clearance while the pill is
    // horizontally over the rect and ramps to zero across a 32 px band beside it (no jump when a roll changes the
    // pill's width or the camera slides the rect past it).
    const pr = ctx.rectToScreen(props.protect);
    const mg = 6;
    const band = 32;
    const ox = Math.min(left + w, pr.x + pr.w + mg + band) - Math.max(left, pr.x - mg - band);
    const up = pr.y - mg - (top + PH);
    const down = pr.y + pr.h + mg - top;
    if (ox > 0 && up < 0 && down > 0) {
      const k = clamp01(ox / band);
      const canUp = top + up >= st.top + 8;
      const canDown = top + down + PH <= st.bottom - 8;
      const preferUp = top + PH / 2 <= pr.y + pr.h / 2;
      const dy = (preferUp && canUp) || !canDown ? up : down;
      top += dy * k * k * (3 - 2 * k);
    }
  }
  return { left, top };
};

// ---- glyph -------------------------------------------------------------------------------------------------------
const glyphState = (tl: Timeline, frame: number) => {
  let kind: "check" | "question" | null = null;
  let prevKind: "check" | "question" | null = null;
  let since = 0;
  let wobbleAt = -1e9;
  for (const g of tl.glyphs) {
    if (g.f > frame) break;
    if (g.kind === "wobble") wobbleAt = g.f;
    else {
      prevKind = kind;
      kind = g.kind;
      since = g.f;
    }
  }
  return { kind, prevKind, t: frame - since, wobble: frame - wobbleAt };
};

/** 40 px badge, check: white ring + 3.5 px white check drawn in 8 f. */
const Check: React.FC<{ drawn: number }> = ({ drawn }) => (
  <svg width={GLYPH} height={GLYPH} viewBox="0 0 40 40" style={{ position: "absolute", left: 0, top: (PH - GLYPH) / 2, overflow: "visible" }}>
    <circle cx={20} cy={20} r={18.5} fill={dim(0.6)} stroke={C.white} strokeWidth={2} />
    <path d="M 11 20.5 L 17.5 27 L 29.5 13.5" fill="none" stroke={C.white} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
      pathLength={1} strokeDasharray={1} strokeDashoffset={1 - drawn} opacity={drawn > 0 ? 1 : 0} />
  </svg>
);
/** 40 px badge, question: accent disc + graphite "?" (the one point of colour of the chip). */
const Question: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: (PH - GLYPH) / 2, width: GLYPH, height: GLYPH, borderRadius: GLYPH / 2, background: C.accent }}>
    <Txt cx={GLYPH / 2} capCenter={GLYPH / 2} size={30} color={C.graphite}>?</Txt>
  </div>
);

const FLIP = 10;
const Glyph: React.FC<{ tl: Timeline; frame: number; left: number }> = ({ tl, frame, left }) => {
  const g = glyphState(tl, frame);
  if (!g.kind) return null;
  // wobble: +-14 deg and a 12 % swell over 12 f (the old +-8 deg on a 20 px mark was invisible on a phone)
  const wob = g.wobble >= 0 && g.wobble < 12;
  const rot = wob ? Math.sin((2 * Math.PI * g.wobble) / 12) * 14 : 0;
  const swell = wob ? 1 + 0.12 * Math.sin((Math.PI * g.wobble) / 12) : 1;
  let node: React.ReactNode;
  let transform = `rotate(${rot}deg) scale(${swell})`;
  if (g.kind === "check") {
    node = <Check drawn={prog(g.t + 1, 2, 8, OUT)} />;
    transform = `rotate(${rot}deg) scale(${swell * lerp(0.4, 1, pop(g.t + 1))})`;
  } else if (g.prevKind === "check" && g.t < FLIP) {
    // flip: the check turns away (5 f), the "?" turns in (5 f), swelling on the way
    const p = (g.t + 1) / FLIP;
    node = p < 0.5 ? <Check drawn={1} /> : <Question />;
    const deg = p < 0.5 ? p * 180 : (1 - p) * 180;
    transform = `rotateX(${deg}deg) scale(${1 + 0.25 * Math.sin(Math.PI * p)})`;
  } else {
    const k = g.prevKind === "check" ? 1 : pop(g.t + 1);
    const breathe = g.t > FLIP ? 1 + 0.1 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (g.t - FLIP)) / 30)) : 1;
    node = <Question />;
    transform = `rotate(${rot}deg) scale(${k * breathe * swell})`;
  }
  return (
    <div style={{ position: "absolute", left, top: 0, width: GLYPH, height: PH, transform, transformOrigin: "50% 50%" }}>{node}</div>
  );
};

/** Frames on which the chip's glyph turns into a "?" (the whole pill pulses there). */
const questionFrames = (tl: Timeline): number[] => tl.glyphs.filter((g) => g.kind === "question").map((g) => g.f);

// ---- element -----------------------------------------------------------------------------------------------------
export const Chip = defineElement<ChipProps>({
  defaultUntil: "closing",
  ownExit: true,
  cues: (beat, r) => {
    const t = beat.props.tick;
    if (t === undefined) {
      // SYSTEM 11: "first chip of a series" = the chip that opens a row
      return beat.props.row && rowOf(beat, r)[0] === beat ? [{ f: beat.at, cue: "tick" as const }] : [];
    }
    if (t === false) return [];
    if (t === true) return [{ f: beat.at, cue: "tick" as const }];
    return t.map((a) => ({ f: r.fr(a, `beat "${beat.id}" tick`), cue: "tick" as const }));
  },

  Screen: ({ ctx }) => {
    const { props, frame, at, age, until } = ctx;
    if (age < 0) return null;
    const tl = timelineOf(ctx.beat, ctx.r);
    const row = rowOf(ctx.beat, ctx.r);
    const m = rowMetrics(ctx, row);
    const w = widthAt(tl, m, frame);
    const { left, top } = place(ctx, row, m, w);

    // in / out
    const kin = pop(age + 1);
    let opacity = clamp01(kin) * (1 - ctx.exit);
    let tx = 0;
    let ty = -8 * ctx.exit;
    let scale = lerp(0.9, 1, kin);
    const origin = "50% 50%";
    if (props.exit === "compact") {
      // Every chip of a row makes the SAME move (up 110 px, left 36 px, x 0.88 about its own centre), one after
      // the other with a 2-frame stagger, so the row keeps its spacing while it leaves. (The old version pulled
      // each chip 55 % of the way to the stage's left edge: the four c4 chips piled up on each other mid-film.)
      const slot = Math.max(0, row.indexOf(ctx.beat));
      const k = INOUT(clamp01((frame - (until - 6) - 2 * slot) / (12 - 2 * Math.min(slot, 3))));
      opacity = clamp01(kin) * (1 - k);
      tx = -36 * k;
      ty = -110 * k;
      scale = lerp(0.9, 1, kin) * lerp(1, 0.88, k);
    }
    // the pill pulses when its glyph flips to "?" (the cut's twist must read on a phone)
    scale *= 1 + 0.06 * Math.max(0, ...questionFrames(tl).map((f) => bump(frame, f + 2, 10)));

    // text
    const { cur, prev, t } = textState(tl, frame);
    const tw = textWidthAt(tl, m, frame);
    const textX = m.pad + DOT + GAP;
    const grows = prev !== null && cur.kind === "build" && cur.text.toUpperCase().startsWith(prev.text.toUpperCase());
    const rolling = prev !== null && t < 1 && !grows;

    // dot
    const changes = tl.texts.map((e) => e.f);
    const dotScale = 1 + 0.5 * Math.max(bumps(frame, changes, 8), bumps(frame, frames(ctx, props.pulses), 8));

    // pin + leader
    let leader: React.ReactNode = null;
    if (props.pin) {
      const pinAt = props.pinAt ? Math.max(at, ctx.fr(props.pinAt)) : at;
      if (frame >= pinAt) {
        const [px, py] = ctx.toScreen(props.pin);
        const qx = Math.max(left + PH / 2, Math.min(left + w - PH / 2, px));
        const qy = top + PH / 2;
        const dist = Math.hypot(px - qx, py - qy);
        const ringO = clamp01((frame - pinAt + 1) / 4);
        let line: React.ReactNode = null;
        if (dist > PH / 2 + 5 + 4) {
          const ux = (px - qx) / dist;
          const uy = (py - qy) / dist;
          const a: Pt = [qx + ux * (PH / 2), qy + uy * (PH / 2)]; // on the pill's edge
          const b: Pt = [px - ux * 5, py - uy * 5]; // on the ring
          const k = prog(frame + 1, pinAt, 6, OUT);
          const fromPin = pinAt === at;
          const p0 = fromPin ? b : a;
          const p1 = fromPin ? a : b;
          line = <line x1={p0[0]} y1={p0[1]} x2={lerp(p0[0], p1[0], k)} y2={lerp(p0[1], p1[1], k)} stroke={C.text2} strokeWidth={1} />;
        }
        leader = (
          <CanvasSvg opacity={opacity}>
            {line}
            <circle cx={px} cy={py} r={5} fill="none" stroke={C.white} strokeWidth={1.5} opacity={ringO} />
          </CanvasSvg>
        );
      }
    }

    return (
      <>
        {leader}
        <div style={{
          position: "absolute", left, top, width: w, height: PH, borderRadius: PH / 2, background: C.cardFill, overflow: "hidden",
          opacity, transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: origin,
        }}>
          <Border radius={PH / 2} />
          <div style={{
            position: "absolute", left: m.pad, top: (PH - DOT) / 2, width: DOT, height: DOT, borderRadius: DOT / 2,
            background: C.accent, transform: `scale(${dotScale})`,
          }} />
          <div style={{ position: "absolute", left: textX, top: 0, width: tw + 2, height: PH, overflow: "hidden" }}>
            {rolling && prev ? (
              <Txt x={0} capCenter={PH / 2} size={m.size} tracking={TRACK} caps style={{ transform: `translateY(${-PH * t}px)` }}>{prev.text}</Txt>
            ) : null}
            <Txt x={0} capCenter={PH / 2} size={m.size} tracking={TRACK} caps
              style={rolling ? { transform: `translateY(${PH * (1 - t)}px)` } : undefined}>{cur.text}</Txt>
          </div>
          <Glyph tl={tl} frame={frame} left={textX + tw + GLYPH_GAP} />
        </div>
      </>
    );
  },
});
