// Anchor resolution (SYSTEM 0.6 / 12): word#occurrence -> frame, with the +-1 frame assertion. ENGINE-OWNED.
import { FPS } from "./tokens";
import type { Anchor, Palavra } from "./types";

export const isWordAnchor = (a: unknown): a is { w: string; n: number; off?: number; f: number } =>
  !!a && typeof a === "object" && typeof (a as { w?: unknown }).w === "string"
  && typeof (a as { n?: unknown }).n === "number" && typeof (a as { f?: unknown }).f === "number";

/** Index in `palavras` of the n-th (1-based) word equal to `w`; -1 when missing. */
export const wordIndex = (palavras: Palavra[], w: string, n: number): number => {
  let seen = 0;
  for (let i = 0; i < palavras.length; i++) {
    if (palavras[i].w === w && ++seen === n) return i;
  }
  return -1;
};

/** Frame on which the word is AUDIBLE (palavras[].s, already snapped to the measured onset by data.ts). */
export const wordFrame = (p: Palavra) => Math.round(p.s * FPS);
/** Frame the TRANSCRIPTION lists for the word (what the storyboards' expected `f` values were written from). */
export const listedFrame = (p: Palavra) => Math.round((p.s0 ?? p.s) * FPS);

/** Resolves an anchor to a frame. Throws when the word does not exist or the storyboard's expected `f` differs by
 *  more than 1 frame from the word's frame.
 *  ONSET SNAP: the frame RETURNED is the word's audible onset (+ off). The expected `f` is accepted when it matches
 *  either the transcription's frame (how every storyboard was written) or the audible frame (a cut author may
 *  re-key `f` to the onset), so no storyboard had to change when the onsets were measured. For most words both
 *  are the same frame. `where` is only used in the error message. */
export const resolveAnchor = (a: Anchor, palavras: Palavra[], where: string): number => {
  if (!a || typeof (a as { f?: unknown }).f !== "number") {
    throw new Error(`[aula] ${where}: anchor without an expected frame "f": ${JSON.stringify(a)}`);
  }
  if (!isWordAnchor(a)) return a.f;
  const i = wordIndex(palavras, a.w, a.n);
  if (i < 0) {
    throw new Error(`[aula] ${where}: word "${a.w}" #${a.n} not found in palavras (exact match, punctuation included)`);
  }
  const f = wordFrame(palavras[i]) + (a.off ?? 0);
  const listed = listedFrame(palavras[i]) + (a.off ?? 0);
  if (Math.abs(listed - a.f) > 1 && Math.abs(f - a.f) > 1) {
    throw new Error(`[aula] ${where}: anchor "${a.w}" #${a.n}${a.off ? ` off ${a.off}` : ""} resolves to frame ${listed}`
      + `${f !== listed ? ` (audible onset: ${f})` : ""}, but the storyboard expects ${a.f} (tolerance 1 frame)`);
  }
  return f;
};

/** Walks any JSON value and validates every word anchor found in it (used on beat props, so nested anchors such
 *  as `pulses`, `rolls[].at` or `qualifier.at` are checked at resolve time even though the engine does not know
 *  the element's prop types). */
export const validateAnchorsDeep = (v: unknown, palavras: Palavra[], where: string): void => {
  if (!v || typeof v !== "object") return;
  if (Array.isArray(v)) {
    v.forEach((x, i) => validateAnchorsDeep(x, palavras, `${where}[${i}]`));
    return;
  }
  if (isWordAnchor(v)) {
    resolveAnchor(v, palavras, where);
    return;
  }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) validateAnchorsDeep(x, palavras, `${where}.${k}`);
};
