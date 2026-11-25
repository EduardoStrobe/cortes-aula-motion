// Phrase-mode captions (spec/ALT.md 4; also the fallback mode named by SYSTEM 5). OWNER: ALT author.
// Pure part: chunking and line wrapping by character count (no font needed, so it runs at resolve time).
// Font part: fitPhrases() measures the words once Manrope is loaded and fixes every word's x (words never reflow).
import { textWidth } from "../fonts";
import { FPS } from "../tokens";
import type { Palavra } from "../types";

export interface PhraseSpec {
  /** word indices per line (1 or 2 lines) */
  lines: number[][];
  /** first word's start frame */
  start: number;
  /** last word's end frame */
  end: number;
  /** frame on which the caption starts clearing (end + 12) when a pause > 0.5 s follows, else null */
  clearAt: number | null;
  /** index (into palavras) of the caption's keyword, or -1 */
  keyword: number;
}
export interface PhraseWord { i: number; t: string; x: number; w: number; line: number; s: number; e: number }
export interface Phrase extends PhraseSpec { size: number; words: PhraseWord[] }

const sf = (p: Palavra) => Math.round(p.s * FPS);
const ef = (p: Palavra) => Math.round(p.e * FPS);
const letters = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, "").length;
/** sentence punctuation (":" and ";" included: "Você diz:" opens a new phrase) */
const endsSentence = (w: string) => /[.!?…:;]["”’)]*$/.test(w);
const endsClause = (w: string) => /[,.!?…:;]["”’)]*$/.test(w);

export const PAUSE_BREAK = 0.25;
export const MAX_CHARS = 22;

/** 1. chunks: break after sentence punctuation and at pauses >= 0.25 s. */
export const chunkWords = (palavras: Palavra[]): number[][] => {
  const out: number[][] = [];
  let cur: number[] = [];
  palavras.forEach((p, i) => {
    cur.push(i);
    const next = palavras[i + 1];
    if (!next || endsSentence(p.w) || next.s - p.e >= PAUSE_BREAK - 1e-6) {
      out.push(cur);
      cur = [];
    }
  });
  return out;
};

/** 2. lines of <= maxChars characters. A word of 1-2 letters that does not end a clause is glued to the next word,
 *  so a line never ends on "de", "a", "o" (SYSTEM 4). The minimum number of lines is kept and, among those
 *  wrappings, the most even one is chosen (least sum of squared slack). */
export const wrapChunk = (palavras: Palavra[], chunk: number[], maxChars = MAX_CHARS): number[][] => {
  // tokens = glued word groups
  const tokens: number[][] = [];
  let run: number[] = [];
  chunk.forEach((i, k) => {
    run.push(i);
    const w = palavras[i].w;
    const last = k === chunk.length - 1;
    const glue = !last && letters(w) <= 2 && !endsClause(w);
    const len = run.map((j) => palavras[j].w).join(" ").length;
    const nextLen = last ? 0 : palavras[chunk[k + 1]].w.length + 1;
    if (!glue || len + nextLen > maxChars) {
      tokens.push(run);
      run = [];
    }
  });
  if (run.length) tokens.push(run);
  const tlen = tokens.map((t) => t.map((j) => palavras[j].w).join(" ").length);
  const n = tokens.length;
  // lineLen(a, b) = length of tokens a..b-1 joined by spaces
  const lineLen = (a: number, b: number) => {
    let l = b - a - 1;
    for (let k = a; k < b; k++) l += tlen[k];
    return l;
  };
  // DP over (tokens used, lines used): minimal lines first, then minimal raggedness
  const INF = 1e12;
  const best: { lines: number; cost: number; prev: number }[] = Array.from({ length: n + 1 }, () => ({ lines: INF, cost: INF, prev: -1 }));
  best[0] = { lines: 0, cost: 0, prev: -1 };
  for (let b = 1; b <= n; b++) {
    for (let a = b - 1; a >= 0; a--) {
      const l = lineLen(a, b);
      if (l > maxChars && b - a > 1) break;
      if (best[a].lines >= INF) continue;
      const slack = Math.max(0, maxChars - l);
      const cand = { lines: best[a].lines + 1, cost: best[a].cost + slack * slack, prev: a };
      if (cand.lines < best[b].lines || (cand.lines === best[b].lines && cand.cost < best[b].cost)) best[b] = cand;
    }
  }
  const cuts: number[] = [];
  for (let b = n; b > 0; b = best[b].prev) cuts.unshift(b);
  const lines: number[][] = [];
  let a = 0;
  for (const b of cuts) {
    lines.push(tokens.slice(a, b).flat());
    a = b;
  }
  return lines;
};

/** 1 + 2 + 3: captions of at most two lines; a longer chunk becomes consecutive captions split at a line
 *  boundary. `keywords` = word indices that turn accent (at most one per caption: throws otherwise). */
export const buildPhrases = (palavras: Palavra[], keywords: number[], where: string, maxChars = MAX_CHARS): PhraseSpec[] => {
  const specs: PhraseSpec[] = [];
  for (const chunk of chunkWords(palavras)) {
    const lines = wrapChunk(palavras, chunk, maxChars);
    for (let k = 0; k < lines.length; k += 2) {
      const ls = lines.slice(k, k + 2);
      const idx = ls.flat();
      const keys = idx.filter((i) => keywords.includes(i));
      if (keys.length > 1) {
        throw new Error(`[aula-alt] ${where}: caption "${idx.map((i) => palavras[i].w).join(" ")}" holds ${keys.length} keywords `
          + `(${keys.map((i) => palavras[i].w).join(", ")}); ALT.md 4 allows one per caption`);
      }
      specs.push({
        lines: ls, start: sf(palavras[idx[0]]), end: ef(palavras[idx[idx.length - 1]]), clearAt: null,
        keyword: keys.length ? keys[0] : -1,
      });
    }
  }
  specs.forEach((p, k) => {
    const last = palavras[p.lines[p.lines.length - 1].slice(-1)[0]];
    const next = specs[k + 1];
    const pause = next ? palavras[next.lines[0][0]].s - last.e : Infinity;
    p.clearAt = pause > 0.5 ? p.end + 12 : null;
  });
  const missing = keywords.filter((i) => !specs.some((p) => p.keyword === i));
  if (missing.length) throw new Error(`[aula-alt] ${where}: keyword(s) not placed: ${missing.join(", ")}`);
  return specs;
};

/** Font step: one size per caption (58 px, reduced so the widest line fits `maxWidth`, never below `floor`) and
 *  the x of every word, measured as width(prefix + word) - width(word) so kerning and spaces are exact. */
export const fitPhrases = (palavras: Palavra[], specs: PhraseSpec[], size: number, maxWidth: number, floor: number,
  tracking: number): Phrase[] =>
  specs.map((p) => {
    const text = (line: number[]) => line.map((i) => palavras[i].w).join(" ");
    const widest = Math.max(...p.lines.map((l) => textWidth(text(l), { size, tracking })));
    const sz = widest <= maxWidth ? size : Math.max(floor, Math.floor((size * maxWidth) / widest));
    const words: PhraseWord[] = [];
    p.lines.forEach((line, li) => {
      line.forEach((i, k) => {
        const upTo = line.slice(0, k + 1).map((j) => palavras[j].w).join(" ");
        const w = textWidth(palavras[i].w, { size: sz, tracking });
        words.push({ i, t: palavras[i].w, x: textWidth(upTo, { size: sz, tracking }) - w, w, line: li, s: sf(palavras[i]), e: ef(palavras[i]) });
      });
    });
    return { ...p, size: sz, words };
  });
