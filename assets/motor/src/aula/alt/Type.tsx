// ALT type layer (ALT.md 3, 4, 5.3, 6, 7): kicker, hook headline, end question, border label, phrase captions,
// name tag, CTA + pill, lockup. Sentence case everywhere except the kicker, the name tag and the pill. Manrope
// 600 / 400 only, colours from the token table, no outlines / shadows / glows on text. OWNER: ALT author.
// REVIEW ROUND 1: kicker parts pop (30 px, accent flash); the headline settles on frame 0, its accent phrase sweeps
// in mid-hook and it LEAVES BEFORE the panel's edge starts to rise (the edge used to slice through it); headline
// and end question are bottom-aligned to the lightbox; border label 36 px with a 36 px glyph badge that pops and
// flips (check -> "?"); captions / name tag / CTA sit right of the camera block (x 348..956); the closing has the
// pill button.
import React from "react";
import { Img, staticFile } from "remotion";
import { HeadlineView, layoutHeadline, type HLayout } from "../components/Headline";
import { capHeight, capOffset, fitSize, textWidth, Txt } from "../fonts";
import { bump, C, clamp01, FONT, INOUT, lerp, OUT, pop, prog } from "../tokens";
import type { Phrase } from "./phrases";
import type { AltResolved, RBeat, RLabelState } from "./resolve";
import { panelTopAt } from "./timeline";
import { A, ALT_CLOSING } from "./tokens";

// ---- kicker ----------------------------------------------------------------------------------------------------------
/** One caps line; each part POPS in on its word (scale 1.35 -> 1 from its left edge, 10 f, in accent, settling to
 *  text2 over the next 14 f) and the whole line fades with the closing pre-roll (8 f). */
export const Kicker: React.FC<{ r: AltResolved; frame: number }> = ({ r, frame }) => {
  const out = 1 - prog(frame, r.P, 8);
  if (out <= 0 || !r.kicker.length || frame < r.kicker[0].f) return null;
  const { x, cy, tracking, maxWidth } = A.kicker;
  const size = fitSize(r.kicker.map((k) => k.text).join(""), { size: A.kicker.size, tracking, caps: true }, maxWidth, 22);
  return (
    <div style={{
      position: "absolute", left: x, top: cy - capHeight(size) / 2 - capOffset(size), height: size, lineHeight: `${size}px`,
      fontFamily: FONT, fontWeight: 600, fontSize: size, letterSpacing: tracking * size, textTransform: "uppercase",
      whiteSpace: "pre", color: C.text2, opacity: out, fontSynthesis: "none",
    }}>
      {r.kicker.map((k, i) => {
        if (frame < k.f) return <span key={i} style={{ opacity: 0 }}>{k.text}</span>;
        const t = prog(frame + 1, k.f, 10, OUT);
        const hot = 1 - prog(frame, k.f + 8, 14);
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", opacity: clamp01(t * 2), transform: `scale(${lerp(1.35, 1, t)})`, transformOrigin: "0% 60%" }}>
            {k.text}
            {hot > 0 ? <span style={{ position: "absolute", left: 0, top: 0, color: C.accent, opacity: hot }}>{k.text}</span> : null}
          </span>
        );
      })}
    </div>
  );
};

// ---- headline / end question -------------------------------------------------------------------------------------------
/** Sentence-case layout: 96 px (or the storyboard size), auto-fit to 900 px with a 76 px floor, pitch 1.08 x size. */
export const altHeadlineLayout = (lines: string[], accent: string, quoted: boolean, size: number, where: string): HLayout => {
  const l = layoutHeadline(lines, accent, quoted, size, A.head.maxWidth, false);
  if (l.size < A.head.floor) {
    throw new Error(`[aula-alt] ${where}: the headline needs ${l.size} px to fit ${A.head.maxWidth} px (floor ${A.head.floor}); shorten a line`);
  }
  return { ...l, pitch: A.head.pitch * l.size };
};

/** Cap-top of line 0: the block is bottom-aligned to the lightbox band (last baseline `gap` px above y 620). */
const headTop = (layout: HLayout) => Math.max(A.head.minTop,
  A.panel.bandTop - A.head.gap - capHeight(layout.size) - (layout.lines.length - 1) * layout.pitch);

/** Type in the top zone never sits on the film: it is clipped at the panel's top edge while that edge travels
 *  (a safety net only: the hook headline is gone before the edge starts, the end question lands after it stops). */
const TopZone: React.FC<{ r: AltResolved; frame: number; children: React.ReactNode }> = ({ r, frame, children }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: panelTopAt(r, frame), overflow: "hidden" }}>{children}</div>
);

/** Hook headline: complete on frame 0 (poster frame), block settle x 0.94 -> 1 over 8 f; the accent phrase starts
 *  white and SWEEPS to accent on r.hookAccentAt (10 f, with a camera punch: a mid-hook event; no per-word scale,
 *  which made the words of a multi-word accent phrase touch: "dobrasde"). Exit: bottom line
 *  first, 5 f per line, 2 f apart, all gone ON H, i.e. before the panel's top edge starts to rise (review: the
 *  edge sliced through half-faded lines for 6 frames). */
export const HookHeadline: React.FC<{ r: AltResolved; frame: number; layout: HLayout }> = ({ r, frame, layout }) => {
  if (frame >= r.H) return null;
  const settle = lerp(0.94, 1, prog(frame, 0, 8, OUT));
  return (
    <TopZone r={r} frame={frame}>
      <HeadlineView layout={layout} x={A.head.x} capTop={headTop(layout)} sweep={prog(frame, r.hookAccentAt, 10)}
        blockTransform={settle < 1 ? `scale(${settle})` : undefined}
        line={(i) => {
          const t = prog(frame, r.H - 5 - 2 * i, 5);
          return { y: -24 * OUT(t), opacity: 1 - t };
        }} />
    </TopZone>
  );
};

/** End question: each word lands on its own spoken frame (translateY 20 -> 0 + opacity, 5 f, OUT); the accent
 *  words arrive already accent. It stays to the last frame. */
export const EndQuestion: React.FC<{ r: AltResolved; frame: number; layout: HLayout }> = ({ r, frame, layout }) => {
  if (frame < r.P + A.edgeDur) return null;
  return (
    <TopZone r={r} frame={frame}>
      <HeadlineView layout={layout} x={A.head.x} capTop={headTop(layout)} sweep={1}
        word={(i, j) => {
          const t = prog(frame + 1, r.endWords[i][j], 5, OUT);
          return { y: 20 * (1 - t), opacity: clamp01(t) };
        }} />
    </TopZone>
  );
};

// ---- border label ------------------------------------------------------------------------------------------------------
type LabelBeat = Extract<RBeat, { el: "BorderLabel" }>;
const L = A.label;
const labelTextW = (s: RLabelState) => textWidth(s.text, { size: L.size });
/** 0 -> 1 growth of the room for the glyph badge (from the state's first glyph on) */
const glyphGrow = (s: RLabelState, frame: number) => (s.glyphs.length ? prog(frame, s.glyphs[0].f, 6, OUT) : 0);
const FLIP = 5;

/** The glyph badge (36 px): white ring + check, or accent disc + graphite "?". It pops in on its word (spring), a
 *  later glyph of the same state REPLACES it with a flip (the outgoing badge turns away over the 5 frames BEFORE
 *  the new one's frame, so a check is never visible on or after the frame of its "?"), and it is gone on `end`. */
const Glyph: React.FC<{ s: RLabelState; frame: number; x: number }> = ({ s, frame, x }) => {
  const k = s.glyphs.findIndex((g) => frame >= g.f && frame < g.end);
  if (k < 0) return null;
  const g = s.glyphs[k];
  const flipIn = k > 0;
  const flipOut = k < s.glyphs.length - 1;
  const leave = clamp01((g.end - frame) / FLIP);
  const enter = flipIn ? prog(frame + 1, g.f, FLIP, OUT) : 1;
  const rot = flipOut && leave < 1 ? 90 * (1 - leave) : flipIn && enter < 1 ? -90 * (1 - enter) : 0;
  const sc = (flipIn ? 1 + 0.25 * bump(frame, g.f, 12) : pop(frame + 1 - g.f)) * (flipOut ? 1 : lerp(0.6, 1, leave));
  const d = L.glyph;
  return (
    <div style={{
      position: "absolute", left: x, top: (L.h - d) / 2, width: d, height: d, opacity: flipOut ? 1 : leave,
      transform: `perspective(200px) rotateY(${rot}deg) scale(${sc})`,
    }}>
      {g.kind === "check" ? (
        <svg width={d} height={d} viewBox="0 0 36 36">
          <circle cx={18} cy={18} r={16.5} fill="none" stroke={C.white} strokeWidth={2.5} />
          <path d="M 10.5 18.5 L 16 24 L 26 12.5" fill="none" stroke={C.white} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog(frame + 1, g.f + 2, 7, OUT)} />
        </svg>
      ) : (
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.accent }}>
          <Txt cx={d / 2} capCenter={d / 2} size={28} color={C.graphite}>?</Txt>
        </div>
      )}
    </div>
  );
};

const LabelText: React.FC<{ s: RLabelState; frame: number; y: number }> = ({ s, frame, y }) => {
  const parts = s.accent ? [s.text.slice(0, s.text.lastIndexOf(s.accent)), s.accent, s.text.slice(s.text.lastIndexOf(s.accent) + s.accent.length)] : [s.text];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, height: L.h, transform: `translateY(${y}px)` }}>
      <Txt x={0} capCenter={L.h / 2} size={L.size}>
        {parts.map((p, i) => <span key={i} style={{ color: s.accent && i === 1 ? C.accent : C.white }}>{p}</span>)}
      </Txt>
      <Glyph s={s} frame={frame} x={labelTextW(s) + L.glyphGap} />
    </div>
  );
};

/** The ONE text label of the body: a tab hanging under the panel's bottom edge (never on the film), right of the
 *  camera block. It names the thing he is talking about (the caption carries the sentence). */
export const BorderLabel: React.FC<{ b: LabelBeat; frame: number }> = ({ b, frame }) => {
  if (frame < b.at || frame >= b.until + 8) return null;
  const { x, y, h, pad, radius } = L;
  let i = 0;
  b.states.forEach((s, k) => {
    if (s.f <= frame) i = k;
  });
  const cur = b.states[i];
  const prev = i > 0 ? b.states[i - 1] : null;
  const roll = prev ? prog(frame, cur.f, 8, OUT) : 1;
  const widthOf = (s: RLabelState, f: number) => labelTextW(s) + (L.glyphGap + L.glyph) * glyphGrow(s, f);
  const inner = prev ? lerp(widthOf(prev, cur.f), widthOf(cur, frame), roll) : widthOf(cur, frame);
  const enter = prog(frame + 1, b.at, 8, OUT);
  const exit = 1 - prog(frame, b.until, 8);
  // the tab pulses when a glyph lands or flips, and on every roll
  let beat = prev ? bump(frame, cur.f, 10) * 0.6 : 0;
  for (const g of cur.glyphs) beat = Math.max(beat, bump(frame, g.f, 10));
  return (
    <div style={{
      position: "absolute", left: x, top: y, height: h, width: inner + 2 * pad, boxSizing: "border-box",
      background: C.cardFill, border: `1px solid ${C.line}`, borderTop: "none", borderRadius: `0 0 ${radius}px ${radius}px`, overflow: "hidden",
      opacity: enter * exit, transform: `translateY(${-14 * (1 - enter)}px) scale(${1 + 0.06 * beat})`, transformOrigin: "0% 0%",
    }}>
      <div style={{ position: "absolute", left: pad - 1, top: 0, right: 0, height: h }}>
        {prev && roll < 1 ? <LabelText s={prev} frame={frame} y={-h * roll} /> : null}
        <LabelText s={cur} frame={frame} y={h * (1 - roll)} />
      </div>
    </div>
  );
};

// ---- phrase captions ---------------------------------------------------------------------------------------------------
export const CAP_TRACK = -0.01;
/** Phrase mode: two fixed lines; a word is invisible until its start frame, then appears in 3 f; the word being
 *  spoken is white, spoken words are text2, the caption's one keyword turns accent on its frame and stays.
 *  Generic part (no ALT state): `x` = left edge, `cy` = cap centres of the two lines. This is also the SYSTEM 5
 *  fallback for c3 / c6: build the phrases with buildPhrases() + fitPhrases() (./phrases) and mount
 *  <PhraseLines frame phrases x={300} cy={[1286, 1358]} /> in the PRIMARY caption band (60 px there). */
export const PhraseLines: React.FC<{ frame: number; phrases: Phrase[]; x: number; cy: readonly [number, number] }> = ({ frame, phrases, x, cy }) => {
  let found: Phrase | null = null;
  for (const q of phrases) if (q.start <= frame) found = q;
  if (!found) return null;
  const p: Phrase = found;
  const fade = p.clearAt === null ? 1 : 1 - prog(frame, p.clearAt, 4);
  if (fade <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: fade }}>
      {p.words.map((w, k) => {
        if (frame < w.s) return null;
        const t = prog(frame + 1, w.s, 3, OUT);
        const next = p.words[k + 1];
        const spokenAt = Math.max(w.e, next ? next.s : w.e);
        // white while it is being spoken, then text2 (4 f); the keyword is accent from its own frame on
        const alpha = lerp(1, 0.72, prog(frame, spokenAt, 4));
        const color = w.i === p.keyword ? C.accent : `rgba(255,255,255,${alpha})`;
        return (
          <Txt key={w.i} x={x + w.x} capCenter={cy[w.line]} size={p.size} tracking={CAP_TRACK} color={color} opacity={t}
            style={{ transform: `translateY(${10 * (1 - t)}px)` }}>{w.t}</Txt>
        );
      })}
    </div>
  );
};

/** ALT captions: hidden while the top zone shows the same words (end question) and after the speech. */
export const PhraseCaptions: React.FC<{ r: AltResolved; frame: number; phrases: Phrase[] }> = ({ r, frame, phrases }) => {
  if (frame >= r.T || r.hide.some(([a, b]) => frame >= a && frame < b)) return null;
  return <PhraseLines frame={frame} phrases={phrases} x={A.caption.x0} cy={A.caption.cy} />;
};

/** Frames on which a caption starts (the bubble gives a small pulse on each). */
export const phraseStarts = (phrases: Phrase[]) => phrases.map((p) => p.start);

// ---- name tag, CTA, pill, lockup ---------------------------------------------------------------------------------------
/** Name tag under the captions. While the captions are hidden for the end question (the caption band would be
 *  empty for 2-3 s) it rises beside the camera block and grows to 34 px; it returns when captions return. */
export const NameTag: React.FC<{ r: AltResolved; frame: number }> = ({ r, frame }) => {
  const { x, cy, cyAlone, size, tracking } = A.nameTag;
  let k = 0;
  for (const [a, b] of r.hide) {
    k = Math.max(k, Math.min(INOUT(clamp01((frame - a) / 10)), b >= r.T ? 1 : 1 - INOUT(clamp01((frame - b) / 10))));
  }
  // after T the CTA takes the band: the tag goes back under it
  k *= 1 - INOUT(clamp01((frame - r.T - 2) / 8));
  return (
    <Txt x={x} capCenter={lerp(cy, cyAlone, k)} size={lerp(size, 34, k)} tracking={tracking} caps color={C.text2}>NOME DO APRESENTADOR</Txt>
  );
};

const CTA_TEXT = { l1: "A resposta está", l2a: "na ", l2b: "aula completa", l2c: "." };
const PILL_TEXT = "ASSISTA À AULA COMPLETA";
/** CTA in the caption zone (rows at T+12 / T+15, translateY 20 -> 0, 6 f), "aula completa" sweeps to accent at
 *  T+24 (+ tick), then the pill button grows from a circle (T+34..44), lands with a bump (T+45, pop) and pulses
 *  once more at T+74. Review: the 56 px CTA with a hairline bar and no button was the weakest end card of the
 *  set; type is now 64 px (auto-fit to x 348..956) and the pill is the primary's. */
export const AltCta: React.FC<{ r: AltResolved; frame: number }> = ({ r, frame }) => {
  const c = frame - r.T;
  if (c < ALT_CLOSING.cta1) return null;
  const { x, x1, cy } = A.cta;
  const size = fitSize(CTA_TEXT.l2a + CTA_TEXT.l2b + CTA_TEXT.l2c, { size: A.cta.size, tracking: -0.01 }, x1 - x, 48);
  const row = (start: number) => {
    const k = prog(c + 1, start, 6, OUT);
    return { opacity: k, style: { transform: `translateY(${20 * (1 - k)}px)` } as React.CSSProperties };
  };
  const a = row(ALT_CLOSING.cta1);
  const b = row(ALT_CLOSING.cta2);
  const sweep = prog(c, ALT_CLOSING.sweep, 8);
  // pill
  const P = A.pill;
  const avail = x1 - x;
  let psz: number = P.size;
  const fullAt = (sz: number) => 2 * P.pad + P.dot + P.dotGap + textWidth(PILL_TEXT, { size: sz, tracking: P.tracking, caps: true });
  while (psz > 24 && fullAt(psz) > avail) psz--;
  const full = Math.min(fullAt(psz), avail);
  const grow = prog(c, ALT_CLOSING.pill, 10, OUT);
  const textOp = prog(c, ALT_CLOSING.pillText, 6);
  const beat = Math.max(bump(c, ALT_CLOSING.pillLand, 10), bump(c, ALT_CLOSING.pillPulse, 12));
  return (
    <>
      <Txt x={x} capCenter={cy[0]} size={size} tracking={-0.01} opacity={a.opacity} style={a.style}>{CTA_TEXT.l1}</Txt>
      <Txt x={x} capCenter={cy[1]} size={size} tracking={-0.01} opacity={b.opacity} style={b.style}>
        {CTA_TEXT.l2a}
        <span style={{ position: "relative", display: "inline-block" }}>
          <span style={{
            color: sweep >= 1 ? C.accent : C.white,
            clipPath: sweep > 0 && sweep < 1 ? `inset(-40% -2% -40% ${sweep * 100}%)` : undefined,
          }}>{CTA_TEXT.l2b}</span>
          {sweep > 0 && sweep < 1 ? (
            <span style={{ position: "absolute", left: 0, top: 0, color: C.accent, clipPath: `inset(-40% ${(1 - sweep) * 100}% -40% -2%)` }}>
              {CTA_TEXT.l2b}
            </span>
          ) : null}
        </span>
        {CTA_TEXT.l2c}
      </Txt>
      {c >= ALT_CLOSING.pill ? (
        <div style={{
          position: "absolute", left: x, top: P.top, width: lerp(P.h, full, grow), height: P.h, borderRadius: P.h / 2, background: C.accentGrad,
          overflow: "hidden", opacity: clamp01((c - ALT_CLOSING.pill + 1) / 3),
          transform: `scale(${1 + 0.05 * beat})`, transformOrigin: "0% 50%",
        }}>
          <div style={{
            position: "absolute", left: P.pad, top: (P.h - P.dot) / 2, width: P.dot, height: P.dot, borderRadius: P.dot / 2,
            background: C.graphite, opacity: textOp, transform: `scale(${1 + 0.6 * beat})`,
          }} />
          <Txt x={P.pad + P.dot + P.dotGap} capCenter={P.h / 2} size={psz} tracking={P.tracking} caps color={C.graphite} opacity={textOp}>{PILL_TEXT}</Txt>
        </div>
      ) : null}
    </>
  );
};

const LESSON = "Nome da aula";
/** The kicker row becomes the lockup: logo (h 40) at T+30, lesson name on one line at T+36 (8 f fades). */
export const AltLockup: React.FC<{ r: AltResolved; frame: number }> = ({ r, frame }) => {
  const c = frame - r.T;
  if (c < ALT_CLOSING.logo) return null;
  const K = A.lockup;
  const size = fitSize(LESSON, { size: K.nameSize, weight: 400 }, K.maxRight - K.nameX, 20);
  return (
    <>
      <Img src={staticFile("brand/logo-marca-branco.png")} style={{ position: "absolute", left: K.logoX, top: K.logoY, height: K.logoH, width: K.logoW, opacity: prog(c, ALT_CLOSING.logo, 8) }} />
      <Txt x={K.nameX} capCenter={K.nameCy} size={size} weight={400} color={C.text2} opacity={prog(c, ALT_CLOSING.lesson, 8)}>{LESSON}</Txt>
    </>
  );
};
