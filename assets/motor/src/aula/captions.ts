// Caption unit building (SYSTEM 5, steps 1-3 are pure; step 4 "fit" needs the font and runs in fitUnits).
// ENGINE-OWNED. ALT phrase mode is NOT implemented here (ALT author).
import { textWidth } from "./fonts";
import { FPS, Z } from "./tokens";
import type { Palavra } from "./types";

export interface CapUnit {
  /** indices into palavras */
  words: number[];
  text: string;
  /** first word's start frame */
  start: number;
  /** last word's end frame */
  end: number;
  /** font size after fitting (px) */
  size: number;
  /** true when the unit is an emphasis unit (already included in `size`) */
  emphasis: boolean;
}

const letters = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, "").length;
const endsSentence = (w: string) => /[.!?…]["”’)]*$/.test(w);
const sf = (p: Palavra) => Math.round(p.s * FPS);
const ef = (p: Palavra) => Math.round(p.e * FPS);
const textOf = (palavras: Palavra[], idx: number[]) => idx.map((i) => palavras[i].w).join(" ");

const endsPunct = (w: string) => /[,;:.!?…]["”’)]*$/.test(w);
/** frames of silence between the end of word i and the (audible) start of word j */
const gapF = (palavras: Palavra[], i: number, j: number) => sf(palavras[j]) - ef(palavras[i]);

/** Longest pause (frames) a unit may bridge: a word is never glued to / merged with a word it is separated from
 *  by more than this ("ali, | radiopaco," had a 14-frame pause inside one unit; "bem, | não" a 1 s one). */
const GLUE_GAP = 6;
const MIN_FRAMES = 8;
const MAX_GLUE_CHARS = 16;
const MAX_MERGE_CHARS = 18;

/** Steps 1-3: one unit per word, glue short words, merge units shorter than 8 frames.
 *  Review fixes on top of the SYSTEM 5 text (a unit must never show a word long before it is spoken, and must
 *  never join two clauses):
 *   - nothing is glued or merged ACROSS punctuation (the left part may not end in , ; : . ! ? …) or across a pause
 *     longer than GLUE_GAP frames;
 *   - a short word that ends in punctuation belongs to the PREVIOUS word ("raio X," instead of "X, porque");
 *   - a unit that is too short and cannot take the whole next unit takes its first word when that fits
 *     ("Eu tenho" 5 f + "uma opacidade" -> "Eu tenho uma" / "opacidade"). */
export const buildUnitGroups = (palavras: Palavra[]): number[][] => {
  // `tight` (step 3 only): a comma may sit inside the unit when the words run on without a pause
  // ("superior, né?"); a sentence end never does.
  // `loose` (last resort for a unit that would otherwise flash for < 8 f, c3 "né?" 5 f): the comma may be
  // bridged up to GLUE_GAP frames ("superior, né?", the tail stays dimmed until it is spoken).
  const joinable = (left: number[], right: number[], maxChars: number, tight = false, loose = false) => {
    const l = left[left.length - 1];
    const w = palavras[l].w;
    const gap = gapF(palavras, l, right[0]);
    if (endsSentence(w) || gap > GLUE_GAP) return false;
    if (endsPunct(w) && !(tight && gap <= 2) && !loose) return false;
    return textOf(palavras, [...left, ...right]).length <= maxChars;
  };
  // 1 + 2
  const groups: number[][] = [];
  for (let i = 0; i < palavras.length; i++) {
    const w = palavras[i].w;
    const short = letters(w) <= 3;
    const prev = groups[groups.length - 1];
    if (short && endsPunct(w) && prev && prev.length <= 2 && joinable(prev, [i], MAX_GLUE_CHARS)) {
      prev.push(i); // "de raio" + "X,"
      continue;
    }
    if (short && !endsPunct(w) && i + 1 < palavras.length && joinable([i], [i + 1], MAX_GLUE_CHARS)) {
      groups.push([i, i + 1]);
      i++;
      continue;
    }
    groups.push([i]);
  }
  // 3
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (let g = 0; g < groups.length - 1; g++) {
      const dur = sf(palavras[groups[g + 1][0]]) - sf(palavras[groups[g][0]]);
      if (dur >= MIN_FRAMES) continue;
      if (joinable(groups[g], groups[g + 1], MAX_MERGE_CHARS, true)) {
        groups.splice(g, 2, [...groups[g], ...groups[g + 1]]);
        changed = true;
        break;
      }
      // take only the first word of the next unit (the rest of it must stay >= MIN_FRAMES long)
      const nx = groups[g + 1];
      if (nx.length > 1 && joinable(groups[g], [nx[0]], MAX_MERGE_CHARS)) {
        const after = g + 2 < groups.length ? sf(palavras[groups[g + 2][0]]) : Infinity;
        if (sf(palavras[nx[1]]) - sf(palavras[groups[g][0]]) >= MIN_FRAMES && after - sf(palavras[nx[1]]) >= MIN_FRAMES) {
          groups.splice(g, 2, [...groups[g], nx[0]], nx.slice(1));
          changed = true;
          break;
        }
      }
      if (g > 0 && joinable(groups[g - 1], groups[g], MAX_MERGE_CHARS, true)) {
        groups.splice(g - 1, 2, [...groups[g - 1], ...groups[g]]);
        changed = true;
        break;
      }
      if (g > 0 && joinable(groups[g - 1], groups[g], MAX_MERGE_CHARS, true, true)) {
        groups.splice(g - 1, 2, [...groups[g - 1], ...groups[g]]);
        changed = true;
        break;
      }
    }
  }
  return groups;
};

const CAP = { size: 92, floor: 64, tracking: -0.01, emph: 1.35 };

/** Step 4 (needs Manrope loaded): font size 92 reduced to fit 640 px, floor 64; a unit still too wide at 64 is
 *  split back at a word boundary. `emphasis` = word indices of emphasis anchors. */
export const fitUnits = (palavras: Palavra[], groups: number[][], emphasis: number[]): CapUnit[] => {
  const out: CapUnit[] = [];
  const widthAt = (text: string, size: number) => textWidth(text, { size, tracking: CAP.tracking });
  const add = (idx: number[]) => {
    const text = textOf(palavras, idx);
    const w92 = widthAt(text, CAP.size);
    let size = w92 <= Z.caption.maxWidth ? CAP.size : Math.floor((CAP.size * Z.caption.maxWidth) / w92);
    if (size < CAP.floor) {
      if (idx.length > 1) {
        const mid = Math.ceil(idx.length / 2);
        add(idx.slice(0, mid));
        add(idx.slice(mid));
        return;
      }
      size = CAP.floor;
    }
    const emph = idx.some((i) => emphasis.includes(i));
    if (emph) {
      const big = size * CAP.emph;
      const wBig = widthAt(text, big);
      size = wBig <= Z.caption.maxWidth ? big : Math.max(size, Math.floor((big * Z.caption.maxWidth) / wBig));
    }
    out.push({ words: idx, text, start: sf(palavras[idx[0]]), end: ef(palavras[idx[idx.length - 1]]), size, emphasis: emph });
  };
  groups.forEach(add);
  return out;
};

export const CAPTION_STYLE = CAP;
