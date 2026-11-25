// Lightbox (ALT.md 2 / 5.1-5.2): lit panel, film window with FilmClip, two clips riding the top edge, progress
// hairline, relay light states, join dip, the c4 "film re-hang", the Scan light sweep. OWNER: ALT author.
// Only FilmView paints footage, and FilmView can only paint films[]: nothing else of the slide can reach the canvas.
import React from "react";
import type { ScreenRect, View } from "../camera";
import { FilmView } from "../components/FilmView";
import { bump, C, clamp01, INOUT, OUT, prog } from "../tokens";
import type { AltResolved } from "./resolve";
import { lightAt, panelTopAt, videoFrameAt, windowAt } from "./timeline";
import { A, lightbox } from "./tokens";

const REHANG = 24;
const LIFT = 4;
/** easeOutBack: lands with a small overshoot (about 10 %) and settles */
const backOut = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** c4 "Te entregam no plantão": the film drops onto the lightbox (translateY -dy -> 0, rotate -deg -> 0, 22 f with
 *  a small overshoot; review: the 28 px / 1.5 deg / 16 f version could not be seen) and both clips bite. */
const rehangAt = (r: AltResolved, frame: number): { transform?: string; clipScale: number } => {
  let transform: string | undefined;
  let clipScale = 1;
  for (const b of r.beats) {
    if (b.el !== "Rehang") continue;
    const d = frame - b.at;
    if (d >= 0 && d < REHANG) {
      // quick lift (4 f), then the drop
      const k = d < LIFT ? OUT((d + 1) / LIFT) : 1 - backOut((d - LIFT) / (REHANG - LIFT));
      transform = `translateY(${-(b.props.dy ?? 70) * k}px) rotate(${-(b.props.deg ?? 4) * k}deg)`;
    }
    // both clips "bite" when the film lands: scaleY 1 -> 0.55 -> 1 over 10 f
    clipScale = Math.min(clipScale, 1 - 0.45 * bump(frame, b.at + 12, 10));
  }
  return { transform, clipScale };
};

/** Scan beats: a 3 px accent line with a soft lightbox-coloured tail travelling once down (or up) the window. */
const Scans: React.FC<{ r: AltResolved; frame: number; win: ScreenRect }> = ({ r, frame, win }) => (
  <>
    {r.beats.map((b) => {
      if (b.el !== "Scan" || frame < b.at || frame > b.at + b.dur) return null;
      const t = (frame - b.at) / b.dur;
      const k = INOUT(t);
      const down = b.props.dir !== "up";
      const y = down ? win.y + win.h * k : win.y + win.h * (1 - k);
      const op = Math.min(1, t / 0.15, (1 - t) / 0.2);
      const tail = 150;
      return (
        <div key={b.id} style={{ position: "absolute", left: win.x, top: 0, width: win.w, height: 1920, opacity: clamp01(op) }}>
          <div style={{
            position: "absolute", left: 0, width: win.w, height: tail, top: down ? y - tail : y,
            background: `linear-gradient(${down ? "to top" : "to bottom"}, ${lightbox(0.22)}, ${lightbox(0)})`,
          }} />
          <div style={{ position: "absolute", left: 0, width: win.w, height: 3, top: y - 1.5, background: C.accent }} />
        </div>
      );
    })}
  </>
);

export const Lightbox: React.FC<{ r: AltResolved; frame: number; view: View; children?: React.ReactNode }> = ({ r, frame, view, children }) => {
  const top = panelTopAt(r, frame);
  const win = windowAt(r, frame);
  const light = lightAt(r, frame);
  const { x0, x1, bottom, radius } = A.panel;
  const hang = rehangAt(r, frame);
  const progress = clamp01(frame / r.T);
  return (
    <>
      {/* panel: flat fill in the brand light token; soft halo only while lit (ALT.md 2) */}
      <div style={{
        position: "absolute", left: x0, top, width: x1 - x0, height: bottom - top, borderRadius: radius,
        background: lightbox(light.fill),
        boxShadow: light.glow > 0 ? `0 0 80px ${lightbox(0.1 * light.glow)}` : undefined,
      }} />
      {/* film window: everything inside is in CANVAS px and clipped by the window */}
      <div style={{ position: "absolute", left: win.x, top: win.y, width: win.w, height: win.h, overflow: "hidden", borderRadius: A.windowRadius }}>
        <div style={{ position: "absolute", left: -win.x, top: -win.y, width: 1080, height: 1920 }}>
          <div style={{
            position: "absolute", left: 0, top: 0, width: 1080, height: 1920,
            transform: hang.transform, transformOrigin: `${win.x + win.w / 2}px ${win.y + win.h / 2}px`,
          }}>
            <FilmView dir={r.dir} films={r.films} view={view} videoFrame={videoFrameAt(r, frame)} brightness={light.film} />
          </div>
          {frame < r.T ? <Scans r={r} frame={frame} win={win} /> : null}
          {children}
        </div>
      </div>
      {/* progress hairline: the only time cue; it leaves with the light so the kept mark is alone on the dark film */}
      {progress > 0 && light.off < 1 ? (
        <div style={{
          position: "absolute", left: win.x, top: top + 1, width: win.w * progress, height: 2, background: C.accent,
          opacity: 1 - light.off,
        }} />
      ) : null}
      {/* clips: overlap the panel's top edge by 14 px and follow it */}
      {A.clip.cx.map((cx) => (
        <div key={cx} style={{
          position: "absolute", left: cx - A.clip.w / 2, top: top - A.clip.h / 2, width: A.clip.w, height: A.clip.h,
          background: C.graphite, border: `1px solid ${C.line}`, borderRadius: A.clip.radius, boxSizing: "border-box",
          transform: hang.clipScale !== 1 ? `scaleY(${hang.clipScale})` : undefined, transformOrigin: "50% 0%",
        }} />
      ))}
    </>
  );
};

/** opacity 0 -> 1 over `dur` frames from `start` (linear) */
export const fadeIn = (frame: number, start: number, dur: number) => prog(frame, start, dur);
