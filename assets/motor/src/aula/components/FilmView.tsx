// FilmView = the slide proxy drawn through a camera with FilmClip (SYSTEM 3.2): ONLY the film rectangles are ever
// painted (clip-path union, 2 px inset, radius 4 slide px); everything else of the slide never reaches the canvas.
// ENGINE-OWNED. Reusable by elements (Compare: a second film layer) and by ALT (lightbox window, Lupa).
// It must be placed inside a container whose (0,0) is the canvas origin (the stage's inner layer is).
import React from "react";
import { Freeze, OffthreadVideo, staticFile } from "remotion";
import { viewCss, type View } from "../camera";
import { roundRectPath } from "../geom";
import { SLIDE, SLIDE_PROXY } from "../tokens";
import type { Film, Rect } from "../types";

/** clip-path of the films that are active on `videoFrame` (film.from/to are frames of the footage). */
export const filmClipPath = (films: Film[], videoFrame: number, only?: string[]): string | null => {
  const act = films.filter((f) => (only ? only.includes(f.id) : true)
    && videoFrame >= (f.from ?? -Infinity) && videoFrame <= (f.to ?? Infinity));
  if (!act.length) return null;
  return act.map((f) => {
    const r: Rect = [f.rect[0] + 2, f.rect[1] + 2, f.rect[2] - 2, f.rect[3] - 2];
    return roundRectPath(r, 4);
  }).join(" ");
};

export interface FilmViewProps {
  /** media folder in public/ ("c1") */
  dir: string;
  films: Film[];
  /** restrict to these film ids (hook panes) */
  only?: string[];
  view: View;
  /** frame of the FOOTAGE to show (the caller applies freezeStageAt / the closing freeze) */
  videoFrame: number;
  /** 1 = untouched; the closing dims to 0.55 (the only processing allowed besides grayscale) */
  brightness?: number;
  /** extra CSS filter appended after grayscale/brightness (transitions only, e.g. "blur(4px)") */
  filter?: string;
  opacity?: number;
}

export const FilmView: React.FC<FilmViewProps> = ({ dir, films, only, view, videoFrame, brightness = 1, filter, opacity }) => {
  const clip = filmClipPath(films, videoFrame, only);
  if (!clip) return null;
  const f = `grayscale(1)${brightness !== 1 ? ` brightness(${brightness})` : ""}${filter ? ` ${filter}` : ""}`;
  return (
    <div style={{
      position: "absolute", left: 0, top: 0, width: SLIDE.w, height: SLIDE.h, transformOrigin: "0 0",
      transform: viewCss(view), clipPath: `path("${clip}")`, opacity, overflow: "hidden",
    }}>
      <Freeze frame={Math.max(0, Math.round(videoFrame))}>
        <OffthreadVideo
          muted
          src={staticFile(`${dir}/slide.mp4`)}
          style={{
            position: "absolute", left: SLIDE_PROXY.dx, top: SLIDE_PROXY.dy, width: SLIDE_PROXY.w, height: SLIDE_PROXY.h,
            maxWidth: "none", filter: f,
          }}
        />
      </Freeze>
    </div>
  );
};
