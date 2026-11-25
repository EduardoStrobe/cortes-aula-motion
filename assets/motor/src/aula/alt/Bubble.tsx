// ALT camera block. CLIENT REQUEST (two passes): "deixa o bloco da câmera dele maior, pois corta o rosto dele" and
// then "pode deixar maiorzinho". The circular bubble (d 180, fixed crop: forehead and glasses only whenever he
// leaned in) is replaced by the engine's camera block: Z.cam, a 270 x 270 px rounded rectangle at x 60, y 1220,
// drawn with <CamCrop>, which follows his head in x and y and paints out the webcam tile's burned-in name label.
// Same behaviour as the primary's FaceBubble: hard switch to a still (+ slow push-in) while the face is lost,
// re-pop on joins and on those switches, speaking segment on the border, frozen after T on closing.faceStill.
// The lightbox ends at y 1204, so nothing sits under the block. OWNER: ALT author.
import React from "react";
import { CamCrop, camOutline, speakingLevel } from "../components/FaceBubble";
import { bumps, C, clamp01, lerp, OUT, prog } from "../tokens";
import type { AltResolved } from "./resolve";
import { A } from "./tokens";

const REPOP = 8;

export const AltBubble: React.FC<{ r: AltResolved; frame: number; starts: number[] }> = ({ r, frame, starts }) => {
  const { x, y, w, h, radius } = A.cam;
  const face = r.face;
  const live = frame < r.T ? frame : r.faceStill;
  let still: number | null = null;
  let zoom = 1;
  const pops: number[] = [...r.joins];
  if (frame < r.T) {
    for (const [a, b] of face.lost) {
      pops.push(a, b + 1);
      if (frame >= a && frame <= b) {
        still = r.sb.face.still;
        zoom = lerp(1, 1.05, clamp01((frame - a) / Math.max(1, b - a)));
      }
    }
  }
  let scale = 1;
  for (const j of pops) {
    if (frame >= j && frame < j + REPOP && j > 0 && j < r.T) scale = Math.min(scale, lerp(0.9, 1, prog(frame, j, REPOP, OUT)));
  }
  const speak = frame < r.T ? speakingLevel(r.data.palavras, frame) : 0;
  const arcOp = frame < r.T ? 0.3 + 0.7 * speak : lerp(0.3, 0, clamp01((frame - r.T) / 6));
  const swell = frame < r.T ? bumps(frame, starts, 6) : 0;
  const seg = lerp(16, 30, speak);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `scale(${scale})`, transformOrigin: "50% 50%" }}>
      <CamCrop dir={r.dir} face={face} videoFrame={still ?? live} w={w} h={h} radius={radius} zoom={zoom} />
      <div style={{ position: "absolute", inset: 0, borderRadius: radius, border: `1px solid ${C.line}`, boxSizing: "border-box" }} />
      {arcOp > 0 ? (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={camOutline(w, h, radius, 1.5, 0.62)} pathLength={100} fill="none" stroke={C.accent} strokeWidth={3 + swell}
            strokeLinecap="round" strokeDasharray={`${seg} ${100 - seg}`} opacity={arcOp} />
        </svg>
      ) : null}
    </div>
  );
};
