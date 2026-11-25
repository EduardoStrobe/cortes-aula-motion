// ALT storyboard -> everything resolved to frames (anchors with the engine's +-1 frame assertion, cameras, beats,
// label states, phrase captions) plus the blocking checks of ALT.md 8-10. OWNER: ALT author.
// Memoised per storyboard object; also called when the compositions are registered, so a bad storyboard fails
// before the first frame.
import { isWordAnchor, resolveAnchor, wordIndex } from "../anchors";
import { S_MAX } from "../camera";
import { makeCursor, type CursorApi } from "../cursor";
import { getCursorData, getCutData, getFaceData } from "../data";
import { CLOSING_FRAMES, FPS } from "../tokens";
import type { Anchor, CutData, FaceData, Film } from "../types";
import { buildPhrases, type PhraseSpec } from "./phrases";
import type { Cue } from "../sound";
import { A, ALT_CLOSING, MAG_MAX } from "./tokens";
import type { AltCam, AltEase, AltStoryboard, AltUntil, BorderLabelProps, LupaProps, MarkerTraceProps, RehangProps, ScanProps } from "./types";

export interface RCamKey { f: number; to: AltCam; dur: number; ease: AltEase; name: string }
export interface RLabelState {
  f: number; text: string; accent?: string;
  /** glyph badges of this state, in time order: each appears on `f` and is gone on `end` (the next glyph of the
   *  state, the next roll or the label's exit) */
  glyphs: { f: number; kind: "check" | "question"; end: number }[];
}
interface RBase { id: string; at: number; until: number; kept: boolean }
export type RBeat =
  | (RBase & { el: "BorderLabel"; props: BorderLabelProps; states: RLabelState[] })
  | (RBase & { el: "MarkerTrace"; props: MarkerTraceProps; pulses: number[] })
  | (RBase & { el: "Lupa"; props: LupaProps; rimAccentAt: number | null })
  | (RBase & { el: "Rehang"; props: RehangProps })
  | (RBase & { el: "Scan"; props: ScanProps; dur: number });

export interface AltResolved {
  sb: AltStoryboard;
  /** media folder in public/ ("c4") */
  dir: string;
  data: CutData;
  cursor: CursorApi;
  face: FaceData;
  films: Film[];
  T: number; total: number; H: number; P: number;
  joins: number[];
  cams: Record<string, AltCam>;
  hookCam: AltCam; hookCamTo: AltCam; hookPush: number;
  /** frame of the hook headline's accent sweep */
  hookAccentAt: number;
  /** footage frame of the camera block after T */
  faceStill: number;
  camKeys: RCamKey[];
  punches: { f: number; amount: number }[];
  kicker: { f: number; text: string }[];
  beats: RBeat[];
  /** word frames of the end question: [line][word] */
  endWords: number[][];
  phrases: PhraseSpec[];
  hide: [number, number][];
  panelFill: number;
  /** frames with a relay click */
  relayAt: number[];
  /** tick / pop cues (re-hang, closing CTA sweep, pill), to be passed through scheduleCues */
  cues: Cue[];
}

const cache = new WeakMap<AltStoryboard, AltResolved>();
const fail = (sb: AltStoryboard, msg: string): never => {
  throw new Error(`[aula-alt] ${sb.id}.alt.json: ${msg}`);
};

export const resolveAlt = (sb: AltStoryboard): AltResolved => {
  const hit = cache.get(sb);
  if (hit) return hit;
  const where = `${sb.id}.alt.json`;
  if (sb.format !== "alt") fail(sb, `format must be "alt"`);
  const data = getCutData(sb.data);
  if (data.frames !== sb.frames) fail(sb, `frames ${sb.frames} != data.frames ${data.frames}`);
  if (sb.closingFrames !== CLOSING_FRAMES) fail(sb, `closingFrames must be ${CLOSING_FRAMES}`);
  const palavras = data.palavras;
  const fr = (a: Anchor, at: string) => resolveAnchor(a, palavras, `${where} ${at}`);
  const T = sb.frames;
  const total = T + CLOSING_FRAMES;
  const H = sb.hook.exit;
  const P = sb.closing.preRoll;
  if (!(H > 8 && H < P && P < T)) fail(sb, `need 8 < hook.exit < closing.preRoll < frames`);
  const stem = sb.data.replace(/\.json$/, "");
  const cursor = makeCursor(getCursorData(sb.cursor));
  const joins = data.segmentos.slice(1).map((s) => Math.round(s.out_start * FPS));

  // ---- privacy: only films[] are ever painted; none of them may touch a forbidden rect -------------------------
  if (!sb.films.length) fail(sb, "films[] is empty");
  for (const film of sb.films) {
    for (const fb of sb.forbid ?? []) {
      const [a0, b0, a1, b1] = film.rect;
      if (a0 < fb[2] && a1 > fb[0] && b0 < fb[3] && b1 > fb[1]) {
        fail(sb, `film "${film.id}" ${JSON.stringify(film.rect)} overlaps the forbidden rect ${JSON.stringify(fb)}`);
      }
    }
  }

  // ---- cameras ---------------------------------------------------------------------------------------------------
  const cam = (name: string, at: string): AltCam => {
    const c = sb.cams[name];
    if (!c) fail(sb, `${at}: unknown camera "${name}"`);
    if (c.s > S_MAX + 1e-9) fail(sb, `camera "${name}" has s ${c.s} > ${S_MAX}`);
    return c;
  };
  const hookCam = cam(sb.hook.cam, "hook.cam");
  const hookPush = sb.hook.push ?? 1.1;
  const hookCamTo = sb.hook.camTo ? cam(sb.hook.camTo, "hook.camTo") : hookCam;
  if (Math.max(hookCam.s, hookCamTo.s) * hookPush > S_MAX + 1e-9) fail(sb, `hook camera s x push exceeds ${S_MAX}`);
  const hookAccentAt = sb.hook.accentAt ? fr(sb.hook.accentAt, "hook.accentAt") : Math.round(H * 0.3);
  if (hookAccentAt < 8 || hookAccentAt > H - 20) fail(sb, `hook.accentAt (f ${hookAccentAt}) must be in 8 .. H - 20`);
  const camKeys: RCamKey[] = sb.camera
    .map((k, i) => ({ f: fr(k.at, `camera[${i}].at`), to: cam(k.to, `camera[${i}]`), dur: k.dur, ease: k.ease ?? "inout", name: k.to }))
    .sort((a, b) => a.f - b.f);
  if (!camKeys.length || camKeys[0].f !== H) fail(sb, `the first camera key must be at hook.exit (${H})`);
  const bodyMoves = camKeys.filter((k) => k.f > H && k.f < P);
  if (bodyMoves.length > 6) fail(sb, `at most 6 camera moves in the body (found ${bodyMoves.length})`);
  if (!camKeys.some((k) => k.f === P && k.name === sb.closing.cam)) {
    fail(sb, `camera[] needs a key at closing.preRoll (${P}) to the closing band camera "${sb.closing.cam}"`);
  }
  cam(sb.closing.cam, "closing.cam");
  // the hook headline's accent sweep carries a small camera punch (as the primary's hook does)
  const punches = [{ f: hookAccentAt, amount: 1.05 },
    ...(sb.punches ?? []).map((p, i) => ({ f: fr(p.at, `punches[${i}].at`), amount: p.amount }))];
  /** largest authored camera scale that can be on screen during [a, b] */
  const maxScale = (a: number, b: number): number => {
    let s = 0;
    camKeys.forEach((k, i) => {
      const nextF = camKeys[i + 1]?.f ?? Infinity;
      if (k.f <= b && nextF > a) s = Math.max(s, k.to.s);
      // a move that is still running at `a` also shows the previous camera
      if (k.f <= a && k.f + k.dur > a && i > 0) s = Math.max(s, camKeys[i - 1].to.s);
    });
    return s || hookCam.s * hookPush;
  };

  // ---- kicker ----------------------------------------------------------------------------------------------------
  const kicker = sb.kicker.map((k, i) => ({ f: fr(k.at, `kicker[${i}].at`), text: k.text }));

  // ---- beats -----------------------------------------------------------------------------------------------------
  const untilOf = (u: AltUntil | undefined, def: "closing" | "end", at: string): number => {
    const v = u ?? def;
    if (v === "closing") return P;
    if (v === "end") return T;
    return fr(v, at);
  };
  const ids = new Set<string>();
  const beats: RBeat[] = sb.beats.map((b, bi): RBeat => {
    const w = `beats[${bi}] "${b.id}"`;
    if (ids.has(b.id)) fail(sb, `duplicate beat id "${b.id}"`);
    ids.add(b.id);
    const at = fr(b.at, `${w}.at`);
    const kept = sb.closing.keep.includes(b.id);
    if (b.el === "BorderLabel") {
      const until = untilOf(b.until, "closing", `${w}.until`);
      if (until > P) fail(sb, `${w}: the border label must be gone by the closing pre-roll (${P})`);
      const states: RLabelState[] = [{ f: at, text: b.props.text, accent: b.props.accent, glyphs: [] },
        ...(b.props.rolls ?? []).map((r, i): RLabelState => ({ f: fr(r.at, `${w}.rolls[${i}].at`), text: r.text, accent: r.accent, glyphs: [] }))];
      states.forEach((s, i) => {
        if (i > 0 && s.f <= states[i - 1].f + 6) fail(sb, `${w}: rolls must be more than 6 frames apart`);
        if (s.accent && !s.text.includes(s.accent)) fail(sb, `${w}: accent "${s.accent}" is not part of "${s.text}"`);
      });
      (b.props.glyph ?? []).forEach((g, i) => {
        const gf = fr(g.at, `${w}.glyph[${i}].at`);
        let si = -1;
        states.forEach((s, k) => {
          if (s.f <= gf) si = k;
        });
        if (si < 0 || gf >= until) fail(sb, `${w}.glyph[${i}] (f ${gf}) is outside the label's life`);
        const gs = states[si].glyphs;
        if (gs.length && gf < gs[gs.length - 1].f + 10) fail(sb, `${w}.glyph[${i}]: glyphs of one state must be >= 10 frames apart, in order`);
        if (gs.length) gs[gs.length - 1].end = gf;
        gs.push({ f: gf, kind: g.kind, end: states[si + 1]?.f ?? until });
      });
      // must-not-reveal (c4): a check is role-play of a wrong reading; none may be visible after noCheckAfter
      for (const st of states) {
        for (const g of st.glyphs) {
          if (g.kind === "check" && sb.noCheckAfter !== undefined && g.end > sb.noCheckAfter) {
            fail(sb, `${w}: the check on "${st.text}" would live until f ${g.end}, past noCheckAfter ${sb.noCheckAfter}`);
          }
        }
      }
      return { id: b.id, el: "BorderLabel", at, until, kept, props: b.props, states };
    }
    if (b.el === "MarkerTrace") {
      const until = untilOf(b.until, "end", `${w}.until`);
      const [f0, f1] = b.props.cursor;
      if (!(f0 >= at - 1 && f1 > f0 && f1 < T)) fail(sb, `${w}: cursor [${f0}, ${f1}] must start on the beat and end before T`);
      if (cursor.path(f0, f1).length < 3) fail(sb, `${w}: the cursor track has fewer than 3 samples in [${f0}, ${f1}]`);
      const pulses = (b.props.pulses ?? []).map((a, i) => fr(a, `${w}.pulses[${i}]`));
      return { id: b.id, el: "MarkerTrace", at, until, kept, props: b.props, pulses };
    }
    if (b.el === "Lupa") {
      const until = untilOf(b.until, "end", `${w}.until`);
      const p = b.props;
      if (p.path.length < 2 || p.path[0].f !== at) fail(sb, `${w}: path must have >= 2 keys and start on the beat (f ${at})`);
      p.path.forEach((k, i) => {
        if (i > 0 && k.f <= p.path[i - 1].f) fail(sb, `${w}: path frames must increase`);
      });
      const pathEnd = p.path[p.path.length - 1].f;
      if (p.park.f <= pathEnd) fail(sb, `${w}: park.f must be after the last path key`);
      // ALT.md 5.5 / 10: camera s x lens <= 2.0 on every keyframe (the renderer also clamps the lens while the
      // camera drifts, so the product never exceeds 2.0 on any frame)
      const s1 = maxScale(at, p.park.f);
      if (s1 * p.lens > MAG_MAX + 1e-9) fail(sb, `${w}: camera s ${s1} x lens ${p.lens} = ${(s1 * p.lens).toFixed(3)} > ${MAG_MAX}`);
      if (p.follow) {
        const [c0, c1] = p.follow.cursor;
        if (c0 <= p.park.f || c1 >= T) fail(sb, `${w}: follow.cursor must start after park.f and end before T`);
        if (!cursor.visible(c0)) fail(sb, `${w}: the pointer is hidden on follow.cursor[0] (f ${c0})`);
        const s2 = maxScale(c0, T + CLOSING_FRAMES);
        if (s2 * p.follow.lens > MAG_MAX + 1e-9) {
          fail(sb, `${w}: camera s ${s2} x follow lens ${p.follow.lens} = ${(s2 * p.follow.lens).toFixed(3)} > ${MAG_MAX}`);
        }
      }
      const rimAccentAt = p.rimAccentAt ? fr(p.rimAccentAt, `${w}.rimAccentAt`) : null;
      return { id: b.id, el: "Lupa", at, until, kept, props: p, rimAccentAt };
    }
    if (b.el === "Scan") {
      const dur = b.props.dur ?? 30;
      if (dur < 12 || dur > 60) fail(sb, `${w}: dur must be 12..60`);
      if (kept) fail(sb, `${w}: a Scan cannot be kept`);
      return { id: b.id, el: "Scan", at, until: at + dur, kept, props: b.props, dur };
    }
    const until = untilOf(b.until, "end", `${w}.until`);
    return { id: b.id, el: "Rehang", at, until, kept, props: b.props };
  });
  for (const k of sb.closing.keep) if (!ids.has(k)) fail(sb, `closing.keep: no beat "${k}"`);

  // ---- end question ----------------------------------------------------------------------------------------------
  const endWords: number[][] = sb.closing.lines.map((l) => l.trim().split(/\s+/).map(() => -1));
  sb.closing.wordSync.forEach((ws, i) => {
    if (endWords[ws.line]?.[ws.word] === undefined) fail(sb, `closing.wordSync[${i}]: no word ${ws.word} in line ${ws.line}`);
    endWords[ws.line][ws.word] = fr(ws.anchor, `closing.wordSync[${i}]`);
  });
  endWords.forEach((l, li) => l.forEach((f, wi) => {
    if (f < 0) fail(sb, `closing: word ${wi} of line ${li} has no wordSync`);
    if (f < P + 18 || f >= T) fail(sb, `closing: word ${wi} of line ${li} (f ${f}) must land between P+18 and T`);
  }));

  // ---- captions --------------------------------------------------------------------------------------------------
  const keywords = sb.captions.keywords.map((a, i) => {
    if (!isWordAnchor(a)) return fail(sb, `captions.keywords[${i}] must be a word anchor`);
    fr(a, `captions.keywords[${i}]`);
    return wordIndex(palavras, a.w, a.n);
  });
  const phrases = buildPhrases(palavras, keywords, where, A.caption.maxChars);

  // ---- sounds (ALT.md 5.2: one relay click at f 2 and at T; the c4 clip tick; nothing else) ----------------------
  const relayAt = [2, T];
  // (review: both cues were masked) the re-hang gets the louder pop, and the closing gets the primary's cues: tick
  // on the CTA sweep, pop when the pill lands, tick on its pulse. scheduleCues() keeps them 20 f apart.
  const cues: Cue[] = [
    ...beats.filter((b) => b.el === "Rehang").map((b): Cue => ({ f: b.at, cue: "pop", gainDb: 0, src: "rehang" })),
    { f: T + ALT_CLOSING.sweep, cue: "tick", gainDb: 0, src: "cta-sweep" },
    { f: T + ALT_CLOSING.pillLand, cue: "pop", gainDb: -2, src: "pill" },
    { f: T + ALT_CLOSING.pillPulse, cue: "tick", gainDb: -4, src: "pill-pulse" },
  ];
  const faceStill = sb.closing.faceStill ?? T - 1;
  if (faceStill < 0 || faceStill >= T) fail(sb, `closing.faceStill must be a frame of the speech`);

  const r: AltResolved = {
    sb, dir: sb.video.split("/")[0], data, cursor, face: getFaceData(stem), films: sb.films, T, total, H, P, joins,
    cams: sb.cams, hookCam, hookCamTo, hookPush, hookAccentAt, faceStill, camKeys, punches, kicker, beats, endWords, phrases,
    hide: sb.captions.hide, panelFill: sb.panelFill ?? 1, relayAt, cues,
  };
  cache.set(sb, r);
  return r;
};
