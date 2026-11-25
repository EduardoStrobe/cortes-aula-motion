// Storyboard resolution: anchors -> frames (with the +-1 assertion), camera track, readouts, beats, token moves,
// sound cues. Pure and memoised per storyboard object. ENGINE-OWNED.
import { resolveAnchor, validateAnchorsDeep, wordIndex } from "./anchors";
import { buildUnitGroups } from "./captions";
import { makeCursor, type CursorApi } from "./cursor";
import { CUTS } from "./cuts";
import { getCursorData, getCutData, getFaceData } from "./data";
import { REGISTRY } from "./elements/registry";
import type { ElementDef } from "./elements/types";
import { applyLook, isRefGeom, type Look } from "./look";
import type { CutModule, PropMove } from "./propTypes";
import { scheduleCues, type Cue } from "./sound";
import { CLOSING_FRAMES, CLOSING_T, FPS } from "./tokens";
import type { Anchor, Cam, CutData, FaceData, PaneSpec, Storyboard, WordSync } from "./types";

export interface StageRect {
  left: number; right: number; top: number; bottom: number;
  cx: number; cy: number; w: number; h: number;
  /** [looks] the rect chips dock to when it is not the stage rect itself (full-bleed: the reference stage box) */
  dock?: { left: number; right: number; top: number; bottom: number };
}
export interface ResolvedBeat<P = Record<string, unknown>> {
  id: string; el: string; index: number;
  at: number; until: number;
  untilKind: "frame" | "closing" | "end";
  kept: boolean;
  props: P;
  pane: number | null;
  def: ElementDef<P>;
  lead: number;
}
export interface ResolvedCamKey { f: number; dur: number; to: Cam; ease: "inout" | "linear" | "out" }
/** `amp` = scale gain of the punch (default 0.045); `auto` = added by the engine, not by the storyboard. */
export interface ResolvedPunch { f: number; amp?: number; auto?: boolean }
export type ResolvedReadout =
  | { type: "countdown"; label: string; arm: number; target: number; zeroTag: string; clear: number }
  | { type: "tally"; label: string; items: number[]; arm: number; clear: number };
export interface ResolvedWordSync { f: number; line: number; word: number; punch: boolean }
export interface ResolvedCover {
  id: string; rect: [number, number, number, number]; label: string;
  at: number; shakes: number[]; pulses: number[]; labelKept: boolean;
}

export interface Resolved {
  /** the storyboard that renders: the file's, with `looks[<look id>]` merged in when a look is selected */
  sb: Storyboard;
  /** the look (theme + layout); the default look for the plain `rp-c<N>` compositions */
  look: Look;
  /** "CASO 0N" (hook.badge, or built from the digits of the storyboard id); drawn when look.layout.badge */
  badge: string;
  /** frame the hook pills pop in on (null = the storyboard has none) */
  pillsAt: number | null;
  /** "c1".."c6": stem of sb.data (face.json key) */
  cut: string;
  /** folder of the media in public/ ("c1") */
  dir: string;
  data: CutData;
  face: FaceData;
  cursor: CursorApi;
  module: CutModule;
  /** T: first frame after the speech */
  T: number;
  /** T + 102 */
  total: number;
  /** H: hook exit */
  H: number;
  /** closing pre-roll start (variant A: preRoll; B: T) */
  P: number;
  variant: "A" | "B";
  /** +4 frames for the CTA when the closing has swapTo (c1) */
  ctaShift: number;
  joins: number[];
  fr(a: Anchor, where?: string): number;
  hook: { accentAt: number; tokenFrom: number | null; wordSync: ResolvedWordSync[]; panes: PaneSpec[] | null };
  closingSync: ResolvedWordSync[];
  camKeys: ResolvedCamKey[];
  punches: ResolvedPunch[];
  readouts: ResolvedReadout[];
  hudPulses: number[];
  hudSubAt: number | null;
  covers: ResolvedCover[];
  beats: ResolvedBeat[];
  tokenMoves: PropMove[];
  tilts: number[];
  /** caption unit groups (steps 1-3 of SYSTEM 5), word indices */
  captionGroups: number[][];
  captionAccent: number[];
  captionEmphasis: number[];
  /** accepted sound cues (after the one-per-20-frames rule) and the rejected ones (for debugging) */
  cues: Cue[];
  cuesSkipped: Cue[];
}

/** effective storyboard -> look -> Resolved (a look without a `looks` block shares the storyboard object with the
 *  default look, so the look is part of the key) */
const cache = new WeakMap<Storyboard, Map<Look, Resolved>>();

/** `lookId` (ENGINE.md "Looks"): undefined / "default" resolves the storyboard exactly as it is written. */
export const resolveStoryboard = (base: Storyboard, lookId?: string | null): Resolved => {
  // applyLook is memoised per (storyboard, look); it returns `base` itself when the look has no override block
  const { sb, look } = applyLook(base, lookId);
  let byLook = cache.get(sb);
  if (!byLook) cache.set(sb, (byLook = new Map()));
  const hit = byLook.get(look);
  if (hit) return hit;
  const tag = look.id === "default" ? `storyboard "${sb.id}"` : `storyboard "${sb.id}" (look ${look.id})`;
  const data = getCutData(sb.data);
  const cut = sb.data.replace(/\.json$/, "");
  const dir = sb.video.split("/")[0];
  if (sb.frames !== data.frames) {
    throw new Error(`[aula] ${tag}: frames ${sb.frames} != data.frames ${data.frames}`);
  }
  const module = CUTS[sb.prop.component];
  if (!module) {
    throw new Error(`[aula] ${tag}: unknown prop.component "${sb.prop.component}" (known: ${Object.keys(CUTS).join(", ")})`);
  }
  const palavras = data.palavras;
  const fr = (a: Anchor, where = "anchor") => resolveAnchor(a, palavras, `${tag} ${where}`);
  const T = sb.frames;
  const total = T + CLOSING_FRAMES;
  const H = sb.hook.exit;
  const variant = sb.closing.variant;
  if (variant === "A" && typeof sb.closing.preRoll !== "number") {
    throw new Error(`[aula] ${tag}: closing variant A needs closing.preRoll`);
  }
  const P = variant === "A" ? (sb.closing.preRoll as number) : T;
  const joins = data.segmentos.slice(1).map((s) => Math.round(s.out_start * FPS));

  const sync = (list: WordSync[] | undefined, where: string): ResolvedWordSync[] =>
    (list ?? []).map((w, i) => ({ f: fr(w.anchor, `${where}[${i}]`), line: w.line, word: w.word, punch: !!w.punch }));

  // ---- camera ----
  const camKeys: ResolvedCamKey[] = [];
  const punches: ResolvedPunch[] = [];
  sb.camera.forEach((k, i) => {
    const f = fr(k.at, `camera[${i}].at`);
    if (k.punch) {
      punches.push({ f });
      return;
    }
    if (!k.to) throw new Error(`[aula] ${tag}: camera[${i}] has no "to" (only punch keyframes may omit it)`);
    // The hook-exit key eases like the stage's top edge (OUT) unless the storyboard says otherwise: with the old
    // INOUT default the film lagged behind the opening edge and an empty band showed above it (c4 f 105-112).
    // PaneSplit hooks keep INOUT (the panes merge with INOUT and the covers must travel with them).
    const dflt = f === H && !(sb.hook.slot.panes && sb.hook.slot.panes.length) ? "out" : "inout";
    camKeys.push({ f, dur: k.cut || joins.includes(f) ? 0 : k.dur, to: k.to, ease: k.ease ?? dflt });
  });
  camKeys.sort((a, b) => a.f - b.f);
  if (!camKeys.length || camKeys[0].f !== H) {
    throw new Error(`[aula] ${tag}: the first camera keyframe must be the hook exit at frame H = ${H}`);
  }
  if (!camKeys.some((k) => k.f === P)) camKeys.push({ f: P, dur: 16, to: sb.closing.slotCam, ease: "inout" });
  camKeys.sort((a, b) => a.f - b.f);
  for (const k of camKeys) {
    if (k.to.s > 2.0001) throw new Error(`[aula] ${tag}: camera scale ${k.to.s} at frame ${k.f} exceeds 2.0`);
  }

  // ---- readouts ----
  const starts = sb.hud.readouts.map((ro, i) =>
    ro.type === "countdown" ? fr(ro.arm, `hud.readouts[${i}].arm`) : fr(ro.items[0], `hud.readouts[${i}].items[0]`));
  const readouts: ResolvedReadout[] = sb.hud.readouts.map((ro, i) => {
    const next = starts.filter((s) => s > starts[i]).sort((a, b) => a - b)[0];
    const clear = ro.clear ? fr(ro.clear, `hud.readouts[${i}].clear`) : Math.min(next ?? P, P);
    if (ro.type === "countdown") {
      const target = fr(ro.target, `hud.readouts[${i}].target`);
      if (target - starts[i] > 12 * FPS) {
        throw new Error(`[aula] ${tag}: countdown ${i} is ${(target - starts[i]) / FPS}s long (max 12 s, SYSTEM 7.1)`);
      }
      return { type: "countdown", label: ro.label, arm: starts[i], target, zeroTag: ro.zeroTag, clear };
    }
    return { type: "tally", label: ro.label, items: ro.items.map((a, j) => fr(a, `hud.readouts[${i}].items[${j}]`)), arm: starts[i], clear };
  });

  // ---- covers ----
  const covers: ResolvedCover[] = (sb.covers ?? []).map((c, i) => {
    const id = c.id ?? `cover${String.fromCharCode(65 + i)}`;
    return {
      id, rect: c.rect, label: c.label, at: fr(c.at, `covers[${i}].at`),
      shakes: (c.shakes ?? []).map((a, j) => fr(a, `covers[${i}].shakes[${j}]`)),
      pulses: (c.pulses ?? []).map((a, j) => fr(a, `covers[${i}].pulses[${j}]`)),
      labelKept: sb.closing.keep.includes(`${id}-label`),
    };
  });

  // ---- beats ----
  const NEVER = total + 1000;
  const seen = new Set<string>();
  const beats: ResolvedBeat[] = sb.beats.map((b, index) => {
    const where = `beats[${index}] "${b.id}"`;
    if (seen.has(b.id)) throw new Error(`[aula] ${tag}: duplicate beat id "${b.id}"`);
    seen.add(b.id);
    const def = (REGISTRY[b.el] ?? module.elements[b.el]) as ElementDef | undefined;
    if (!def) {
      throw new Error(`[aula] ${tag} ${where}: unknown element "${b.el}" (registry: ${Object.keys(REGISTRY).join(", ")}; `
        + `cut: ${Object.keys(module.elements).join(", ") || "none"})`);
    }
    const at = fr(b.at, `${where}.at`);
    validateAnchorsDeep(b.props, palavras, `${tag} ${where}.props`);
    const kept = sb.closing.keep.includes(b.id);
    let until: number;
    let untilKind: ResolvedBeat["untilKind"];
    if (b.until !== undefined && typeof b.until !== "string") {
      until = fr(b.until, `${where}.until`);
      untilKind = "frame";
    } else {
      const d = b.until ?? def.defaultUntil ?? "closing";
      if (typeof d === "function") {
        until = d({ at, props: b.props }, { T, P });
        untilKind = "frame";
      } else {
        untilKind = d;
        until = d === "closing" ? P : T;
      }
      if (kept) until = NEVER;
    }
    const pane = typeof b.pane === "number" ? b.pane : null;
    if (pane !== null) {
      if (!sb.hook.slot.panes || !sb.hook.slot.panes[pane]) throw new Error(`[aula] ${tag} ${where}: pane ${pane} does not exist`);
      until = Math.min(until, H + 10);
    }
    return { id: b.id, el: b.el, index, at, until, untilKind, kept, props: b.props, pane, def, lead: def.lead ?? 0 };
  });
  // ---- automatic hook filler (review: nothing happened between the slam and the hook exit) ----
  // When the storyboard has no beat starting in the second half of the hook (f 40 .. H - 12), a soft ScanLine
  // crosses the slot at about 58 % of the hook. Opt out with hook.autoMotion: false. Not in PaneSplit hooks (the
  // stage is not shown there).
  const hasPanes = !!(sb.hook.slot.panes && sb.hook.slot.panes.length);
  if (sb.hook.autoMotion !== false && !hasPanes && REGISTRY.ScanLine
    && !beats.some((b) => b.pane === null && b.at >= 40 && b.at <= H - 12)) {
    const at = Math.round(H * 0.58);
    const def = REGISTRY.ScanLine as ElementDef;
    const props = { dur: 30, opacity: 0.6 };
    beats.push({
      id: "auto-hook-scan", el: "ScanLine", index: beats.length, at, until: at + 30, untilKind: "frame", kept: false,
      props, pane: null, def, lead: def.lead ?? 0,
    });
  }
  for (const k of sb.closing.keep) {
    if (sb.beats.length && !seen.has(k) && !covers.some((c) => `${c.id}-label` === k)) {
      // not fatal: cut authors add beats later, but a typo here silently drops a mark at T
      // eslint-disable-next-line no-console
      console.warn(`[aula] ${tag}: closing.keep lists "${k}" but no beat / cover label has that id`);
    }
  }

  // ---- token moves ----
  const accentAt = fr(sb.hook.accentAt, "hook.accentAt");
  const tokenMoves: PropMove[] = [];
  if (sb.hook.tokenMove) tokenMoves.push({ name: sb.hook.tokenMove, at: accentAt });
  (sb.tokenMoves ?? []).forEach((m, i) =>
    tokenMoves.push({ name: m.name, at: fr(m.at, `tokenMoves[${i}].at`), dur: m.dur, args: m.args }));
  if (sb.closing.propMove) tokenMoves.push({ name: sb.closing.propMove, at: T + 8 });
  tokenMoves.sort((a, b) => a.at - b.at);

  const tilts = (sb.stageFx ?? []).filter((x) => x.type === "tilt").map((x, i) => fr(x.at, `stageFx[${i}].at`));

  // ---- captions ----
  const widx = (a: Anchor, where: string): number => {
    fr(a, where);
    const w = a as { w?: string; n?: number };
    if (typeof w.w !== "string" || typeof w.n !== "number") {
      throw new Error(`[aula] ${tag} ${where}: caption accent/emphasis must be word anchors`);
    }
    return wordIndex(palavras, w.w, w.n);
  };
  const captionAccent = sb.captions.accent.map((a, i) => widx(a, `captions.accent[${i}]`));
  const captionEmphasis = sb.captions.emphasis.map((a, i) => widx(a, `captions.emphasis[${i}]`));

  // ---- automatic camera punches (review: the body camera was locked for 8-27 s stretches) ----
  // hook: one punch (x 1.06) on the accent sweep. Body: a punch (x 1.045) on every captions.accent / emphasis word
  // and on every countdown zero, unless a camera move is running or about to start (key within 20 f) or another
  // punch was accepted less than 45 f before. Storyboard punches always win. Opt out: camera auto punches follow
  // hook.autoMotion (hook) and storyboard.autoPunch (body).
  if (sb.hook.autoMotion !== false && !punches.some((p) => Math.abs(p.f - accentAt) < 30)) {
    punches.push({ f: accentAt, amp: 0.06, auto: true });
  }
  if (sb.autoPunch !== false) {
    const cand = [
      ...captionAccent.concat(captionEmphasis).map((i) => Math.round(palavras[i].s * FPS)),
      ...readouts.filter((ro) => ro.type === "countdown").map((ro) => (ro as { target: number }).target),
    ].filter((f) => f > H + 20 && f < P - 30).sort((a, b) => a - b);
    for (const f of cand) {
      if (camKeys.some((k) => f > k.f - 20 && f < k.f + k.dur + 10)) continue;
      if (joins.some((j) => Math.abs(f - j) < 12)) continue;
      if (punches.some((p) => Math.abs(p.f - f) < 45)) continue;
      punches.push({ f, auto: true });
    }
  }
  punches.sort((a, b) => a.f - b.f);

  const num = /\d+/.exec(sb.id);
  const r: Resolved = {
    sb, look,
    badge: sb.hook.badge ?? `CASO ${num ? num[0].padStart(2, "0") : sb.id.toUpperCase()}`,
    pillsAt: sb.hook.pills ? (sb.hook.pills.at ? fr(sb.hook.pills.at, "hook.pills.at") : 0) : null,
    cut, dir, data, face: getFaceData(cut), cursor: makeCursor(getCursorData(sb.cursor)), module,
    T, total, H, P, variant, ctaShift: sb.closing.swapTo ? 4 : 0, joins, fr,
    hook: {
      accentAt,
      tokenFrom: sb.hook.tokenFrom ? fr(sb.hook.tokenFrom, "hook.tokenFrom") : null,
      wordSync: sync(sb.hook.wordSync, "hook.wordSync"),
      panes: sb.hook.slot.panes && sb.hook.slot.panes.length ? sb.hook.slot.panes : null,
    },
    closingSync: sync(sb.closing.wordSync, "closing.wordSync"),
    camKeys, punches, readouts,
    hudPulses: (sb.hud.pulses ?? []).map((a, i) => fr(a, `hud.pulses[${i}]`)),
    hudSubAt: sb.hud.sub ? fr(sb.hud.sub.at, "hud.sub.at") : null,
    covers, beats, tokenMoves, tilts,
    captionGroups: buildUnitGroups(palavras), captionAccent, captionEmphasis,
    cues: [], cuesSkipped: [],
  };
  if (!r.hook.panes && !sb.hook.slot.cam) throw new Error(`[aula] ${tag}: hook.slot needs "cam" or "panes"`);
  if (r.hook.panes && !isRefGeom(look)) {
    throw new Error(`[aula] ${tag}: a PaneSplit hook needs the reference stage boxes (look.layout.stage); this look moves them`);
  }

  // ---- sound cues (engine first, then storyboard, then elements; one cue per 20 frames) ----
  const want: Cue[] = [];
  const push = (f: number, cue: Cue["cue"], src: string, gainDb = 0) => want.push({ f, cue, gainDb, src });
  // Review: c2 / c5 / c6 open on 0.3-0.6 s of dead air and every closing was 3 s of digital silence after one
  // pop. A soft pop marks the headline on frame 1 (it wins over an accent tick closer than 20 f: c4 / c5 / c6,
  // whose sweep is on f 10), and the closing gets one cue per landing: CTA accent sweep, pill, pill pulse.
  push(1, "pop", "hook headline", -3);
  push(accentAt, "tick", "hook accent sweep");
  push(H + 2, "whoosh", "stage open");
  push(P + 2, "whoosh", "stage close");
  joins.forEach((j) => push(j, "whoosh", "JoinBlink", -6));
  for (const ro of readouts) {
    if (ro.type !== "countdown") continue;
    for (const d of [90, 60, 30]) if (ro.target - d >= ro.arm) push(ro.target - d, "tick", "countdown last 3 s");
    push(ro.target, "pop", "countdown zero");
  }
  push(T + 8, "pop", "closing prop callback");
  const shift = sb.closing.swapTo ? 4 : 0; // = ctaShift
  push(T + CLOSING_T.sweep + shift, "tick", "CTA accent sweep");
  push(T + CLOSING_T.pillLand + shift, "pop", "closing pill", -2);
  push(T + CLOSING_T.pillPulse + shift, "tick", "closing pill pulse", -4);
  tilts.forEach((f) => push(f, "whoosh", "stage tilt"));
  covers.forEach((c) => c.shakes.forEach((f) => push(f, "tick", `${c.id} shake`)));
  (sb.sounds ?? []).forEach((s, i) => push(fr(s.at, `sounds[${i}].at`), s.cue, `storyboard sounds[${i}]`, s.gainDb ?? 0));
  for (const b of beats) {
    for (const q of b.def.cues?.(b, r) ?? []) push(q.f, q.cue, `beat ${b.id}`, q.gainDb ?? 0);
  }
  const sched = scheduleCues(want, total);
  r.cues = sched.accepted;
  r.cuesSkipped = sched.skipped;

  byLook.set(look, r);
  return r;
};
