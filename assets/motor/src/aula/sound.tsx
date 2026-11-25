// Sound cue scheduling (SYSTEM 11): ONE speech track + tick / pop / whoosh, never more than one cue in any
// 20-frame window (the later one is skipped). ENGINE-OWNED; ALT may reuse scheduleCues + <CueTrack>.
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { CueName } from "./types";

export interface Cue {
  f: number;
  cue: CueName;
  /** extra gain in dB (<= 0) on top of the level baked into the wav */
  gainDb: number;
  /** who asked (debugging) */
  src: string;
}

export const CUE_WINDOW = 20;
const CUE_FRAMES: Record<CueName, number> = { tick: 3, pop: 4, whoosh: 9 };

/** Stable sort by frame (earlier requests win ties), then greedy: a cue closer than 20 frames to the last
 *  accepted one is skipped. */
export const scheduleCues = (want: Cue[], total: number): { accepted: Cue[]; skipped: Cue[] } => {
  const sorted = want.map((c, i) => ({ c, i })).sort((a, b) => a.c.f - b.c.f || a.i - b.i).map((x) => x.c);
  const accepted: Cue[] = [];
  const skipped: Cue[] = [];
  // Priority on a collision: pop (an event landed) > whoosh (a transition) > tick. A later cue of higher
  // priority replaces the last accepted one when that keeps the 20-frame distance to the one before it.
  const prio: Record<CueName, number> = { pop: 3, whoosh: 2, tick: 1 };
  for (const c of sorted) {
    if (c.f < 0 || c.f >= total) {
      skipped.push(c);
      continue;
    }
    const lastC = accepted[accepted.length - 1];
    if (lastC && c.f - lastC.f < CUE_WINDOW) {
      const before = accepted[accepted.length - 2];
      if (prio[c.cue] > prio[lastC.cue] && (!before || c.f - before.f >= CUE_WINDOW)) {
        skipped.push(accepted.pop() as Cue);
        accepted.push(c);
      } else {
        skipped.push(c);
      }
      continue;
    }
    accepted.push(c);
  }
  return { accepted, skipped };
};

export const CueTrack: React.FC<{ cues: Cue[] }> = ({ cues }) => (
  <>
    {cues.map((c) => (
      <Sequence key={`${c.cue}-${c.f}`} from={c.f} durationInFrames={CUE_FRAMES[c.cue] + 2} layout="none">
        <Audio src={staticFile(`sfx/${c.cue}.wav`)} volume={Math.pow(10, c.gainDb / 20)} />
      </Sequence>
    ))}
  </>
);
