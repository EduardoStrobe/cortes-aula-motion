// One-word captions (SYSTEM 5): unit pop, accent word on its own frame, emphasis size, pause fade, silence dots,
// hide intervals. Units come from captions.ts (fitUnits). ENGINE-OWNED.
import React from "react";
import { CAPTION_STYLE, type CapUnit } from "../captions";
import { Txt } from "../fonts";
import { inkAt } from "../look";
import type { Resolved } from "../resolve";
import { clamp01, FPS, lerp, pop, Z } from "../tokens";

const Dots: React.FC<{ t: number; color: string }> = ({ t, color }) => (
  <>
    {[0, 1, 2].map((i) => {
      const ph = (((t - i * 5) % 30) + 30) % 30;
      const o = ph < 10 ? 0.3 + 0.7 * Math.sin((ph / 10) * Math.PI) : 0.3;
      return (
        <div key={i} style={{
          position: "absolute", left: Z.caption.cx - 5 + (i - 1) * 26, top: Z.caption.cy - 5, width: 10, height: 10,
          borderRadius: 5, background: color, opacity: o,
        }} />
      );
    })}
  </>
);

export const Captions: React.FC<{ r: Resolved; frame: number; units: CapUnit[] }> = ({ r, frame, units }) => {
  if (frame >= r.T) return null;
  // [looks] a look whose hook headline sits in the caption band shows no captions before H
  if (!r.look.layout.hookCaptions && frame < r.H) return null;
  const ink = inkAt(r.look, Z.caption.cy);
  const hide = r.sb.captions.hide;
  if (hide.some(([a, b]) => frame >= a && frame < b)) return null;
  let i = -1;
  for (let k = 0; k < units.length; k++) if (units[k].start <= frame) i = k;
  if (i < 0) return units.length && units[0].start > 45 && frame >= 6 ? <Dots t={frame} color={ink.dots} /> : null;
  const u = units[i];
  const next = i + 1 < units.length ? units[i + 1].start : r.T;
  // a unit that started inside a hide interval is not shown for its last few frames after the interval ends
  // (c2: one word flashed for ONE frame between the headline's hide window and the next caption)
  if (hide.some(([a, b]) => u.start >= a && u.start < b && frame >= b && next - b < 8)) return null;
  const gap = next - u.end;
  let op = 1;
  if (gap > 15) op = 1 - clamp01((frame - (u.end + 6)) / 6);
  if (op <= 0) return gap > 45 && frame >= u.end + 12 ? <Dots t={frame - (u.end + 12)} color={ink.dots} /> : null;
  const f = frame - u.start;
  const k = pop(f + 1);
  const pal = r.data.palavras;
  return (
    <Txt
      cx={Z.caption.cx} capCenter={Z.caption.cy} size={u.size} tracking={CAPTION_STYLE.tracking}
      // 2-frame fade (was 3): many units of the fast cuts last 7-9 frames and spent a third of that half-visible
      opacity={op * clamp01((f + 1) / 2)}
      style={{ transform: `translateX(-50%) translateY(${14 * (1 - k)}px) scale(${lerp(0.86, 1, k)})`, transformOrigin: "50% 50%" }}
    >
      {u.words.map((wi, n) => {
        const ws = Math.round(pal[wi].s * FPS);
        const on = r.captionAccent.includes(wi) && frame >= ws;
        // a later word of a multi-word unit stays dimmed until it is spoken (it lights up over 2 frames on its
        // own start), so the unit never "says" a word before the voice does
        const lit = n === 0 ? 1 : clamp01((frame - ws + 2) / 2);
        if (on && ink.word.mode === "tab") {
          // [looks] accent word on a tab (blue on blue / blue on white fails as type): the tab is painted behind
          // the word without changing the line's metrics
          return (
            <span key={wi}>
              {n ? " " : ""}
              <span style={{ position: "relative", display: "inline-block" }}>
                <span style={{
                  position: "absolute", left: "-0.14em", right: "-0.14em", top: "0.03em", bottom: "-0.1em", borderRadius: "0.16em",
                  background: ink.word.fill,
                }} />
                <span style={{ position: "relative", color: ink.word.text }}>{pal[wi].w}</span>
              </span>
            </span>
          );
        }
        return (
          <span key={wi} style={{ color: on && ink.word.mode === "colour" ? ink.word.color : ink.text, opacity: lerp(ink.capDim, 1, lit) }}>
            {(n ? " " : "") + pal[wi].w}
          </span>
        );
      })}
    </Txt>
  );
};
