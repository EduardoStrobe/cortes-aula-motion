// AltCut — the ALT format "Negatoscopio" (spec/ALT.md) as ONE composition driven by an ALT storyboard JSON.
// One object in a dark room: a lightbox holding the film, the doctor's pointer turned into a marker / magnifier,
// calm sentence-case type, phrase captions. No HUD, countdown, chips, props or rail. OWNER: ALT author.
// Layers, bottom to top: dark room, lightbox (panel, film, marks, hairline, clips), bubble, kicker / lockup,
// camera block, headline / end question, border label, captions / CTA + pill, name tag. Audio: ONE speech track, the
// relay click at f 2 and at T, the c4 re-hang pop and the closing cues (CTA sweep tick, pill pop, pill pulse tick).
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { useFontsReady } from "../fonts";
import { Background } from "../AulaCut";
import { CueTrack, scheduleCues } from "../sound";
import { C, FONT } from "../tokens";
import { AltBubble } from "./Bubble";
import { Lightbox } from "./Lightbox";
import { Lupas, MarkerTraces, PointerDots } from "./Marks";
import { fitPhrases } from "./phrases";
import { resolveAlt } from "./resolve";
import { viewAt } from "./timeline";
import { A } from "./tokens";
import { AltCta, AltLockup, altHeadlineLayout, BorderLabel, CAP_TRACK, EndQuestion, HookHeadline, Kicker, NameTag, PhraseCaptions, phraseStarts } from "./Type";
import type { AltStoryboard } from "./types";

export type AltCutProps = { storyboard: AltStoryboard };

export const AltCut: React.FC<AltCutProps> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const ready = useFontsReady();
  const r = useMemo(() => resolveAlt(storyboard), [storyboard]);
  const type = useMemo(() => {
    if (!ready) return null;
    const { hook, closing, id } = r.sb;
    const phrases = fitPhrases(r.data.palavras, r.phrases, A.caption.size, A.caption.x1 - A.caption.x0, A.caption.floor, CAP_TRACK);
    return {
      hook: altHeadlineLayout(hook.lines, hook.accent, hook.quoted, hook.size, `${id}.alt hook`),
      end: altHeadlineLayout(closing.lines, closing.accent, closing.quoted ?? false, closing.size, `${id}.alt closing`),
      phrases, starts: phraseStarts(phrases),
    };
  }, [ready, r]);
  const cues = useMemo(() => scheduleCues(r.cues, r.total).accepted, [r]);
  const view = viewAt(r, frame);
  return (
    <AbsoluteFill style={{ background: C.graphite, fontFamily: FONT, fontWeight: 600, fontSynthesis: "none", color: C.white }}>
      <Background frame={frame} total={r.total} light={false} />
      <Audio src={staticFile(`${r.dir}/audio.wav`)} />
      {r.relayAt.map((f) => (
        <Sequence key={f} from={f} durationInFrames={4} layout="none">
          <Audio src={staticFile("sfx/relay.wav")} />
        </Sequence>
      ))}
      <CueTrack cues={cues} />
      {type ? (
        <>
          <Lightbox r={r} frame={frame} view={view}>
            <MarkerTraces r={r} frame={frame} view={view} />
            <PointerDots r={r} frame={frame} view={view} />
            <Lupas r={r} frame={frame} view={view} />
          </Lightbox>
          <AltBubble r={r} frame={frame} starts={type.starts} />
          <Kicker r={r} frame={frame} />
          <AltLockup r={r} frame={frame} />
          <HookHeadline r={r} frame={frame} layout={type.hook} />
          <EndQuestion r={r} frame={frame} layout={type.end} />
          {r.beats.map((b) => (b.el === "BorderLabel" ? <BorderLabel key={b.id} b={b} frame={frame} /> : null))}
          <PhraseCaptions r={r} frame={frame} phrases={type.phrases} />
          <AltCta r={r} frame={frame} />
          <NameTag r={r} frame={frame} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
