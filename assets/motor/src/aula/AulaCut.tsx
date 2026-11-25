// AulaCut — ONE generic composition driven entirely by a storyboard JSON (SYSTEM 12). ENGINE-OWNED.
// Layers, bottom to top: background, stage (film, patches, covers, marks, chips/props, JoinBlink), rail + HUD /
// headline, CTA, caption band (bubble, captions, lockup). Audio: ONE speech track + scheduled cues.
import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { fitUnits } from "./captions";
import { Captions } from "./components/Captions";
import { Cta, Lockup } from "./components/Closing";
import { FaceBubble } from "./components/FaceBubble";
import { ClosingHeadline, HookHeadline, HudTag, KickerRow, Rail, Readouts } from "./components/Hud";
import { Stage } from "./components/Stage";
import { HookLogo, HookPills } from "./components/Looks";
import { useFontsReady } from "./fonts";
import type { Look } from "./look";
import { resolveStoryboard } from "./resolve";
import { CueTrack } from "./sound";
import { C, CLOSING_FRAMES, FONT, FPS, H, lerp, setFilmPalette, W } from "./tokens";
import type { Storyboard } from "./types";

/** `look` (ENGINE.md "Looks"): id of a look of look.ts; omitted = the approved default output. */
export type AulaCutProps = { storyboard: Storyboard; look?: string };

/** Background (SYSTEM 1): graphite gradient + one radial light drifting (300,500) -> (340,520) over the cut. */
export const Background: React.FC<{ frame: number; total: number; light?: boolean; look?: Look }> = ({ frame, total, light = true, look }) => {
  const t = total > 1 ? frame / (total - 1) : 0;
  const x = lerp(300, 340, t);
  const y = lerp(500, 520, t);
  // [looks] a look brings its own page gradient, may switch the radial light off (light pages) and may split the
  // page: everything below look.split.y is a second surface
  const bg = look ? look.bg.css : C.bg;
  const lit = look ? look.bg.light : light;
  return (
    <>
      <AbsoluteFill style={{
        background: lit
          ? `radial-gradient(600px circle at ${x}px ${y}px, rgba(255,255,255,0.03), transparent), ${bg}`
          : bg,
      }} />
      {look && look.split ? (
        <div style={{ position: "absolute", left: 0, top: look.split.y, width: W, height: H - look.split.y, background: look.split.css }} />
      ) : null}
    </>
  );
};

export const AulaCut: React.FC<AulaCutProps> = ({ storyboard, look: lookId }) => {
  const frame = useCurrentFrame();
  const ready = useFontsReady();
  const r = useMemo(() => resolveStoryboard(storyboard, lookId), [storyboard, lookId]);
  // [looks] the live C / dim() tokens answer with this look's on-film palette for everything rendered below (one
  // AulaCut is mounted per page); put the default back when the composition goes away (studio)
  setFilmPalette(r.look.film);
  useEffect(() => () => setFilmPalette(null), []);
  const units = useMemo(
    () => (ready ? fitUnits(r.data.palavras, r.captionGroups, r.captionEmphasis) : []),
    [ready, r],
  );
  const unitStarts = useMemo(() => units.map((u) => u.start), [units]);
  return (
    <AbsoluteFill style={{ background: r.look.bg.color, fontFamily: FONT, fontWeight: 600, fontSynthesis: "none", color: r.look.ink.text }}>
      <Background frame={frame} total={r.total} look={r.look} />
      <Audio src={staticFile(`${r.dir}/audio.wav`)} />
      <CueTrack cues={r.cues} />
      {ready ? (
        <>
          <Stage r={r} frame={frame} />
          <Rail r={r} frame={frame} />
          <KickerRow r={r} frame={frame} />
          <HudTag r={r} frame={frame} />
          <Readouts r={r} frame={frame} />
          <HookHeadline r={r} frame={frame} />
          <ClosingHeadline r={r} frame={frame} />
          <Cta r={r} frame={frame} />
          <HookPills r={r} frame={frame} />
          <HookLogo r={r} frame={frame} />
          <FaceBubble r={r} frame={frame} unitStarts={unitStarts} />
          <Captions r={r} frame={frame} units={units} />
          <Lockup r={r} frame={frame} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** durationInFrames = speech + 102 (SYSTEM 0.8). Throws early (in the studio and the CLI) on any storyboard error. */
export const aulaMetadata: CalculateMetadataFunction<AulaCutProps> = ({ props }) => {
  resolveStoryboard(props.storyboard, props.look);
  return { durationInFrames: props.storyboard.frames + CLOSING_FRAMES, fps: FPS, width: W, height: H };
};
