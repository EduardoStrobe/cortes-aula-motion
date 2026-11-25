// ALT format "Negatoscopio" (spec/ALT.md) — composition list spread into src/Root.tsx.
// OWNER: the ALT author (this whole folder).
// Compositions: "rp-c4-alt" and "rp-c6-alt" (1080x1920, 30 fps, durationInFrames = frames + 102).
// The ALT storyboards are imported here (not through the engine-owned ../storyboards.ts). They are resolved by
// AltCut on its first frame (resolve.ts throws on a bad anchor / camera / privacy rule); nothing is resolved at
// import time, so an ALT storyboard error can never break the PRIMARY compositions registered by Root.
import type React from "react";
import c4 from "../../storyboards/c4.alt.json";
import c6 from "../../storyboards/c6.alt.json";
import { CLOSING_FRAMES } from "../tokens";
import { AltCut } from "./AltCut";
import type { AltStoryboard } from "./types";

export interface AltComposition {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.FC<any>;
  durationInFrames: number;
  defaultProps?: Record<string, unknown>;
}

const ALT_STORYBOARDS = [c4, c6] as unknown as AltStoryboard[];

export const ALT_COMPOSITIONS: AltComposition[] = ALT_STORYBOARDS.map((storyboard) => ({
  id: `rp-${storyboard.id}-alt`,
  component: AltCut,
  durationInFrames: storyboard.frames + CLOSING_FRAMES,
  defaultProps: { storyboard },
}));
