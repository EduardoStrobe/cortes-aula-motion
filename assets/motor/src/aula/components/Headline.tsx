// Headline / EndQuestion (SYSTEM 4, 9, 10): ALL-CAPS Manrope 600, auto-fit (widest line <= 900 px), left x 60, first
// cap-top y 356, line pitch 1.04 x size, ONE accent word/phrase revealed by a left-to-right sweep, typographic
// quotes in text2 for verbatim lines. Layout is precomputed (no reflow); the caller supplies the animation state.
// ENGINE-OWNED.
import React from "react";
import { capHeight, capOffset, textWidth } from "../fonts";
import type { AccentWord } from "../look";
import { C, clamp01, FONT, Z } from "../tokens";

const TRACK = -0.02;
const PITCH = 1.04;
/** Extra word gap in em: Manrope's space is narrow and with -0.02em tracking ALL-CAPS words visually touch
 *  ("ARCOCOSTAL"); +0.06em keeps the words apart on a phone. Included in the auto-fit width. */
const WORD_GAP = 0.06;

export interface HWord { t: string; accent: boolean; x: number; w: number; a0: number; a1: number }
export interface HLine { words: HWord[]; open: boolean; close: boolean; width: number; qw: number }
export interface HLayout {
  size: number; lines: HLine[]; pitch: number;
  /** [looks] px of room left on each side of the accent phrase for its tab (0 = the accent is only recoloured) */
  tabPad: number;
}
/** [looks] colours of a headline: text, typographic quotes and the accent treatment (colour or tab). */
export interface HeadInk { text: string; quote: string; accent: AccentWord }

/** Precomputes sizes and word boxes. `accent` = one word or consecutive words (exact, case-insensitive) that
 *  must exist in one line. Throws when it does not (a storyboard typo must not silently lose the accent).
 *  [looks] `tabPadEm` > 0 reserves that much room (em) before and after the accent phrase for a tab: the words
 *  after it move right, the auto-fit counts it, and an accent phrase that opens a line is indented by the pad so
 *  the TAB's edge (not the word) sits on the left margin. */
export const layoutHeadline = (lines: string[], accent: string, quoted: boolean, size: number,
  maxWidth: number = Z.headline.maxWidth, caps = true, tabPadEm = 0): HLayout => {
  const txt = lines.map((l) => (caps ? l.toUpperCase() : l).trim().split(/\s+/));
  const acc = (caps ? accent.toUpperCase() : accent).trim().split(/\s+/).filter(Boolean);
  let accLine = -1;
  let accFrom = -1;
  if (acc.length) {
    for (let i = 0; i < txt.length && accLine < 0; i++) {
      for (let j = 0; j + acc.length <= txt[i].length; j++) {
        if (acc.every((a, k) => txt[i][j + k] === a)) {
          accLine = i;
          accFrom = j;
          break;
        }
      }
    }
    if (accLine < 0) throw new Error(`[aula] headline accent "${accent}" not found in lines ${JSON.stringify(lines)}`);
  }
  const full = (i: number) => `${quoted && i === 0 ? "“" : ""}${txt[i].join(" ")}${quoted && i === txt.length - 1 ? "”" : ""}`;
  const st = (sz: number) => ({ size: sz, tracking: TRACK });
  // width of a line as it is DRAWN: natural text + the extra word gap (see WORD_GAP)
  const lineW = (i: number, sz: number) => textWidth(full(i), st(sz)) + (txt[i].length - 1) * WORD_GAP * sz
    + (tabPadEm > 0 && i === accLine ? 2 * tabPadEm * sz : 0);
  const widest = Math.max(...txt.map((_, i) => lineW(i, size)));
  const sz = widest <= maxWidth ? size : Math.floor((size * maxWidth) / widest);
  // gap between two words = space advance + the tracking after the previous letter and after the space + WORD_GAP
  const space = textWidth("A A", st(sz)) - textWidth("AA", st(sz)) + TRACK * sz + WORD_GAP * sz;
  const qw = textWidth("“", st(sz)) + TRACK * sz;
  const tabPad = tabPadEm > 0 && accLine >= 0 ? tabPadEm * sz : 0;
  const out: HLine[] = txt.map((words, i) => {
    const open = quoted && i === 0;
    const close = quoted && i === txt.length - 1;
    let x = open ? qw : 0;
    const ws: HWord[] = words.map((t, j) => {
      const w = textWidth(t, st(sz));
      if (tabPad > 0 && i === accLine && j === accFrom) x += tabPad;
      const hw: HWord = { t, accent: i === accLine && j >= accFrom && j < accFrom + acc.length, x, w, a0: 0, a1: 1 };
      x += w + space;
      if (tabPad > 0 && i === accLine && j === accFrom + acc.length - 1) x += tabPad;
      return hw;
    });
    // sweep range of each accent word inside the whole accent phrase
    const aw = ws.filter((w) => w.accent);
    if (aw.length) {
      const x0 = aw[0].x;
      const x1 = aw[aw.length - 1].x + aw[aw.length - 1].w;
      aw.forEach((w) => {
        w.a0 = (w.x - x0) / (x1 - x0);
        w.a1 = (w.x + w.w - x0) / (x1 - x0);
      });
    }
    return { words: ws, open, close, width: lineW(i, sz), qw };
  });
  return { size: sz, lines: out, pitch: PITCH * sz, tabPad };
};

export interface WordAnim { y?: number; opacity?: number; scale?: number }
export interface LineAnim { y?: number; opacity?: number }
export interface HeadlineViewProps {
  layout: HLayout;
  /** left edge and cap-top of line 0 (defaults: 60, 356) */
  x?: number; capTop?: number;
  line?: (i: number) => LineAnim;
  word?: (i: number, j: number) => WordAnim;
  /** accent sweep progress 0..1 over the accent phrase */
  sweep: number;
  /** transform / opacity of the whole block (collapse); origin = top-left of the block */
  blockTransform?: string; blockOpacity?: number;
  /** [looks] colours (default: white, text2 quotes, accent word recoloured to the accent token) */
  ink?: HeadInk;
}

export const HeadlineView: React.FC<HeadlineViewProps> = ({ layout, x = Z.left, capTop = Z.headline.capTop, line, word,
  sweep, blockTransform, blockOpacity, ink }) => {
  const { size } = layout;
  const textC = ink ? ink.text : C.white;
  const quoteC = ink ? ink.quote : C.text2;
  const tab = ink && ink.accent.mode === "tab" ? ink.accent : null;
  const accC = tab ? tab.text : ink && ink.accent.mode === "colour" ? ink.accent.color : C.accent;
  const base: React.CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: size, lineHeight: `${size}px`, letterSpacing: TRACK * size,
    whiteSpace: "pre", fontSynthesis: "none",
  };
  return (
    <div style={{
      position: "absolute", left: x, top: capTop, width: 0, height: 0, transformOrigin: "0 0",
      transform: blockTransform, opacity: blockOpacity,
    }}>
      {layout.lines.map((ln, i) => {
        const la = line ? line(i) : {};
        if ((la.opacity ?? 1) <= 0) return null;
        const top = i * layout.pitch - capOffset(size);
        const lastW = ln.words[ln.words.length - 1];
        const lastA = word ? word(i, ln.words.length - 1) : {};
        const firstA = word ? word(i, 0) : {};
        return (
          <div key={i} style={{ position: "absolute", left: 0, top, height: size, opacity: la.opacity, transform: `translateY(${la.y ?? 0}px)`, ...base }}>
            {ln.open ? <span style={{ position: "absolute", left: 0, top: 0, color: quoteC, opacity: firstA.opacity }}>“</span> : null}
            {tab && sweep > 0 ? (() => {
              // [looks] accent TAB: a rounded block behind the accent phrase, growing left to right with the sweep
              const aw = ln.words.map((w, j) => ({ w, j })).filter((e) => e.w.accent);
              if (!aw.length) return null;
              const first = aw[0];
              const last = aw[aw.length - 1];
              const pad = layout.tabPad;
              const an = word ? word(i, first.j) : {};
              const x0 = first.w.x - pad;
              const wTab = last.w.x + last.w.w + pad - x0;
              return (
                <span style={{
                  position: "absolute", left: x0, top: capOffset(size) - 0.13 * size, width: wTab,
                  height: capHeight(size) + 0.26 * size, borderRadius: 0.14 * size, background: tab.fill,
                  opacity: an.opacity, transform: `translateY(${an.y ?? 0}px)`,
                  clipPath: sweep < 1 ? `inset(0px ${(1 - sweep) * 100}% 0px 0px round ${0.14 * size}px)` : undefined,
                }} />
              );
            })() : null}
            {ln.words.map((w, j) => {
              const wa = word ? word(i, j) : {};
              if ((wa.opacity ?? 1) <= 0) return null;
              const local = w.accent ? clamp01((sweep - w.a0) / Math.max(1e-6, w.a1 - w.a0)) : 0;
              // during the sweep the white copy is clipped to the part not yet swept (no white fringe under the accent)
              return (
                <span key={j} style={{
                  position: "absolute", left: w.x, top: 0, opacity: wa.opacity,
                  // punch from the word's centre, growth capped at 0.08em per side so a punched word never
                  // touches its neighbour ("GANHAUM")
                  transform: `translateY(${wa.y ?? 0}px) scale(${1 + Math.min((wa.scale ?? 1) - 1, (0.16 * size) / Math.max(1, w.w))})`,
                  transformOrigin: "50% 50%",
                }}>
                  <span style={{
                    color: local >= 1 ? accC : textC,
                    clipPath: local > 0 && local < 1 ? `inset(-40% -2% -40% ${local * 100}%)` : undefined,
                  }}>{w.t}</span>
                  {local > 0 && local < 1 ? (
                    <span style={{
                      position: "absolute", left: 0, top: 0, color: accC,
                      clipPath: `inset(-40% ${(1 - local) * 100}% -40% -2%)`,
                    }}>{w.t}</span>
                  ) : null}
                </span>
              );
            })}
            {ln.close ? (
              <span style={{ position: "absolute", left: lastW.x + lastW.w + TRACK * size + (lastW.accent ? layout.tabPad : 0), top: 0, color: quoteC, opacity: lastA.opacity,
                transform: `translateY(${lastA.y ?? 0}px)` }}>”</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
