// Static data lookup: word timings, cursor tracks and face keys (src/data/*). ENGINE-OWNED.
import type { CursorData, CutData, FaceData } from "./types";
import c1 from "../data/c1.json";
import c2 from "../data/c2.json";
import c3 from "../data/c3.json";
import c4 from "../data/c4.json";
import c5 from "../data/c5.json";
import c6 from "../data/c6.json";
import k1 from "../data/cursor-c1.json";
import k2 from "../data/cursor-c2.json";
import k3 from "../data/cursor-c3.json";
import k4 from "../data/cursor-c4.json";
import k5 from "../data/cursor-c5.json";
import k6 from "../data/cursor-c6.json";
import face from "../data/face.json";
import faceTrack from "../data/face-track.json";
import onsets from "../data/onsets.json";

const DATA: Record<string, unknown> = {
  "c1.json": c1, "c2.json": c2, "c3.json": c3, "c4.json": c4, "c5.json": c5, "c6.json": c6,
};
const CURSOR: Record<string, unknown> = {
  "cursor-c1.json": k1, "cursor-c2.json": k2, "cursor-c3.json": k3,
  "cursor-c4.json": k4, "cursor-c5.json": k5, "cursor-c6.json": k6,
};

const cutCache = new Map<string, CutData>();
/** Word timings of a cut. palavras[i].s is the AUDIBLE start: where scripts/onsets.py measured that the
 *  transcribed start sits in silence (first word after a pause; e.g. c2 "Cadê" 964 -> 977), `s` is the measured
 *  onset and `s0` keeps the transcription's value (anchors are checked against s0, see anchors.ts). */
export const getCutData = (file: string): CutData => {
  const hit = cutCache.get(file);
  if (hit) return hit;
  const d = DATA[file] as CutData | undefined;
  if (!d) throw new Error(`[aula] unknown data file "${file}" (expected c1.json .. c6.json)`);
  const on = ((onsets as unknown as Record<string, Record<string, number>>)[file.replace(/\.json$/, "")] ?? {});
  const palavras = d.palavras.map((p, i) => {
    const t = on[String(i)];
    if (typeof t !== "number" || !(t > p.s)) return p;
    const next = d.palavras[i + 1];
    return { ...p, s: next ? Math.min(t, next.s) : t, s0: p.s };
  });
  const out: CutData = { ...d, palavras };
  cutCache.set(file, out);
  return out;
};
export const getCursorData = (file: string): CursorData => {
  const d = CURSOR[file];
  if (!d) throw new Error(`[aula] unknown cursor file "${file}" (expected cursor-c1.json .. cursor-c6.json)`);
  return d as CursorData;
};
/** cut = "c1".."c6" */
const faceCache = new Map<string, FaceData>();
/** face.json entry of the cut, completed with the head track of face-track.json (when the cut has one): `track`
 *  drives the crop centre in x and y, and the track file's `lost` list REPLACES face.json's (it was re-checked
 *  on bubble strips with the new framing). */
export const getFaceData = (cut: string): FaceData => {
  const hit = faceCache.get(cut);
  if (hit) return hit;
  const d = (face as unknown as Record<string, FaceData>)[cut];
  if (!d || !d.keys) throw new Error(`[aula] face.json has no entry for "${cut}"`);
  const t = (faceTrack as unknown as Record<string, { step: number; pts: [number, number][]; lost?: [number, number][] } | undefined>)[cut];
  const out: FaceData = t && Array.isArray(t.pts) && t.pts.length
    ? { ...d, track: { step: t.step, pts: t.pts }, lost: t.lost ?? d.lost }
    : d;
  faceCache.set(cut, out);
  return out;
};
