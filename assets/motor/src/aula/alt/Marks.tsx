// The two ALT instruments (ALT.md 5.4-5.5): MarkerTrace (+ pointer halo) and Lupa. OWNER: ALT author.
// Both are rendered INSIDE the lightbox window's inner layer (canvas px, clipped by the window) and sit above the
// film, so the relay-off dimming of the film never touches them: they are the "open spot" of the closing.
// REVIEW ROUND 1:
//   * MarkerTrace: 7 px accent over an 11 px under-stroke (3 / 5 px could not be seen at feed size), pulse to 11.
//   * Pointer: a 48 px accent HALO centred on the recorded arrow (cursor.follow()); the old white dot trailed the
//     arrow by 20-30 px and read as a second pointer.
//   * Lupa, second phase (riding his pointer on the spine): the lens was a blank grey disc (flat mediastinum at
//     2.0 x) that lagged the pointer by up to its own radius. Now a 250 px ring at lens 1.15 that follows the arrow
//     with a 5-frame window, so the arrow stays near its centre; rim 4 px.
//   * Closing: the kept Lupa keeps the film INSIDE it lit (SPOT) while the room goes dark: a lit spot instead of a
//     hairline circle on black; kept marks breathe 1 -> 0.45 with a small swell.
import React from "react";
import { makeView, toScreen, toSlide, viewSvg, type View } from "../camera";
import { FilmView } from "../components/FilmView";
import { catmullRomPath } from "../geom";
import { bumps, C, clamp01, dim, INOUT, lerp, OUT, prog } from "../tokens";
import type { Pt } from "../types";
import type { AltResolved, RBeat } from "./resolve";
import { breatheAt, lightAt, videoFrameAt, viewAt, windowAt } from "./timeline";
import { lightbox, MAG_MAX, SPOT } from "./tokens";

type TraceBeat = Extract<RBeat, { el: "MarkerTrace" }>;
type LupaBeat = Extract<RBeat, { el: "Lupa" }>;

const TRACE = { w: 7, under: 11, pulse: 4 };

/** opacity of a mark after T: kept marks stay (and breathe in the hold), the others fade over T..T+6 */
const afterT = (r: AltResolved, kept: boolean, frame: number) =>
  frame < r.T ? 1 : kept ? 1 - 0.55 * breatheAt(r, frame) : 1 - prog(frame, r.T, 6);

// ---- MarkerTrace ---------------------------------------------------------------------------------------------------
/** SVG layer (canvas px) with the live marker line, drawn in slide space through the camera. */
export const MarkerTraces: React.FC<{ r: AltResolved; frame: number; view: View }> = ({ r, frame, view }) => {
  const vf = videoFrameAt(r, frame);
  const px = (n: number) => n / view.s;
  const traces = r.beats.filter((b): b is TraceBeat => b.el === "MarkerTrace");
  if (!traces.length) return null;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <g transform={viewSvg(view)}>
        {traces.map((b) => {
          const [f0, f1] = b.props.cursor;
          if (vf < f0) return null;
          // LIVE pen: the path runs through his pointer samples from f0 to "now" (5-sample average, Catmull-Rom)
          const pts = r.cursor.path(f0, Math.min(vf, f1));
          if (pts.length < 2) return null;
          const d = catmullRomPath(pts);
          const k = bumps(frame, b.pulses, 10) + (frame >= r.T && b.kept ? 0.5 * (1 - breatheAt(r, frame)) * prog(frame, r.T, 20) : 0);
          const op = afterT(r, b.kept, frame);
          if (op <= 0) return null;
          const line = { d, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
          return (
            <g key={b.id}>
              <path {...line} stroke={dim(0.5)} strokeWidth={px(TRACE.under + TRACE.pulse * k)} opacity={frame < r.T ? 1 : op} />
              <path {...line} stroke={C.accent} strokeWidth={px(TRACE.w + TRACE.pulse * k)} opacity={op} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

/** Pointer halo: after the trace's f1 a 48 px accent ring (3 px, on a dim under-ring) sits ON the recorded arrow
 *  until the beat's `until` (then fades, 6 f). */
export const PointerDots: React.FC<{ r: AltResolved; frame: number; view: View }> = ({ r, frame, view }) => (
  <>
    {r.beats.map((b) => {
      if (b.el !== "MarkerTrace" || b.props.pointerDot === false) return null;
      const f1 = b.props.cursor[1];
      if (frame <= f1 || frame > b.until + 6) return null;
      const p = r.cursor.follow(videoFrameAt(r, frame), 10);
      if (!p) return null;
      const [x, y] = toScreen(view, p);
      const op = Math.min(prog(frame, f1, 4), 1 - prog(frame, b.until, 6));
      if (op <= 0) return null;
      const d = 48;
      return (
        <div key={b.id} style={{ position: "absolute", left: x - d / 2, top: y - d / 2, width: d, height: d, opacity: op }}>
          <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: `7px solid ${dim(0.45)}`, boxSizing: "border-box" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${C.accent}`, boxSizing: "border-box" }} />
        </div>
      );
    })}
  </>
);

// ---- Lupa ----------------------------------------------------------------------------------------------------------
const UNPARK = 14;
/** room kept between the rim and the window edge (the 6 px outer ring just touches the edge) */
const EDGE = 2;
const RIM = 4;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** diameter and nominal lens of the Lupa on frame f */
const lupaSize = (b: LupaBeat, f: number): { d: number; lens: number } => {
  const p = b.props;
  const pathEnd = p.path[p.path.length - 1].f;
  if (p.follow && f >= p.follow.cursor[0]) {
    const k = INOUT(clamp01((f - p.follow.cursor[0]) / UNPARK));
    return { d: lerp(p.park.d, p.follow.d, k), lens: lerp(1, p.follow.lens, k) };
  }
  const k = INOUT(clamp01((f - pathEnd) / (p.park.f - pathEnd)));
  return { d: lerp(p.d, p.park.d, k), lens: lerp(p.lens, 1, k) };
};

/** scripted slide position: linear between the path keys, then on to the park point */
const scripted = (b: LupaBeat, f: number): Pt => {
  const keys = [...b.props.path, { f: b.props.park.f, pt: b.props.park.pt }];
  if (f <= keys[0].f) return keys[0].pt;
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i].f) return lerpPt(keys[i - 1].pt, keys[i].pt, (f - keys[i - 1].f) / (keys[i].f - keys[i - 1].f));
  }
  return keys[keys.length - 1].pt;
};

/** un-smoothed screen centre on frame f: the scripted point (or the recorded arrow) through the camera, kept
 *  inside the window so the lens is never cut by the film's edge */
const rawCentre = (r: AltResolved, b: LupaBeat, f: number): Pt => {
  const ff = Math.max(b.at, Math.min(f, r.T - 1));
  const view = viewAt(r, ff);
  const win = windowAt(r, ff);
  const { d } = lupaSize(b, ff);
  const m = d / 2 + EDGE;
  const inWin = ([x, y]: Pt): Pt => [
    Math.max(win.x + m, Math.min(win.x + win.w - m, x)), Math.max(win.y + m, Math.min(win.y + win.h - m, y)),
  ];
  const parked = inWin(toScreen(view, scripted(b, ff)));
  const fo = b.props.follow;
  if (!fo || ff < fo.cursor[0]) return parked;
  const cur = r.cursor.follow(Math.min(ff, fo.cursor[1]), 1000);
  if (!cur) return parked;
  return lerpPt(parked, inWin(toScreen(view, cur)), INOUT(clamp01((ff - fo.cursor[0]) / UNPARK)));
};

/** triangular moving average of half-width `hw` frames */
const glideW = (r: AltResolved, b: LupaBeat, f: number, hw: number): Pt => {
  let x = 0;
  let y = 0;
  let n = 0;
  for (let k = -hw; k <= hw; k++) {
    const w = hw + 1 - Math.abs(k);
    const p = rawCentre(r, b, f + k);
    x += p[0] * w;
    y += p[1] * w;
    n += w;
  }
  return [x / n, y / n];
};
/** glide: scripted search = a 17-frame triangular window (rounds the path's corners); riding the pointer = a
 *  5-frame one (his arrow updates at 15 fps and jumps; the wide window trailed it by up to a lens radius) */
const glide = (r: AltResolved, b: LupaBeat, f: number): Pt => {
  const fo = b.props.follow;
  if (!fo || f < fo.cursor[0]) return glideW(r, b, f, 8);
  const k = clamp01((f - fo.cursor[0]) / UNPARK);
  return k >= 1 ? glideW(r, b, f, 2) : lerpPt(glideW(r, b, f, 8), glideW(r, b, f, 2), k);
};

export interface LupaState {
  x: number; y: number; d: number;
  /** effective lens factor (nominal, clamped so that camera s x lens <= 2.0) */
  lens: number;
  /** total magnification of the lens content (screen px per slide px) */
  mag: number;
  /** slide point under the lens centre */
  centre: Pt;
}
/** Everything about the Lupa on `frame` (exported so the QA script and the composition agree). */
export const lupaAt = (r: AltResolved, b: LupaBeat, frame: number, view: View): LupaState => {
  const { d, lens } = lupaSize(b, Math.min(frame, r.T - 1));
  let c: Pt;
  if (frame < r.T) {
    // the glide averages centres that were clamped to the window of THEIR frame; while the panel's top edge
    // travels (closing pre-roll) the average can lag behind it, so the result is clamped to the current window too
    const g = glide(r, b, frame);
    const win = windowAt(r, frame);
    const m = d / 2 + EDGE;
    c = [Math.max(win.x + m, Math.min(win.x + win.w - m, g[0])), Math.max(win.y + m, Math.min(win.y + win.h - m, g[1]))];
  } else {
    // closing: the lens stops; it stays glued to the film while the band camera pushes in
    const last = r.T - 1;
    c = toScreen(view, toSlide(viewAt(r, last), glide(r, b, last)));
  }
  const eff = Math.max(1, Math.min(lens, MAG_MAX / view.s));
  return { x: c[0], y: c[1], d, lens: eff, mag: view.s * eff, centre: toSlide(view, c) };
};

export const Lupas: React.FC<{ r: AltResolved; frame: number; view: View }> = ({ r, frame, view }) => {
  const light = lightAt(r, frame);
  return (
    <>
      {r.beats.map((b) => {
        if (b.el !== "Lupa" || frame < b.at) return null;
        const op = afterT(r, b.kept, frame);
        if (op <= 0) return null;
        const st = lupaAt(r, b, frame, view);
        const grow = prog(frame + 1, b.at, 8, OUT);
        const closing = frame >= r.T && b.kept;
        const swell = closing ? 1 + 0.04 * (1 - breatheAt(r, frame)) : 1;
        const d = st.d * swell;
        const accentK = b.rimAccentAt === null ? 0 : prog(frame, b.rimAccentAt, 8);
        const lensView = makeView({ cx: st.centre[0], cy: st.centre[1], s: st.mag }, { x: st.x - d / 2, y: st.y - d / 2, w: d, h: d });
        const dotR = d / 2 - RIM / 2;
        const a = Math.PI / 4;
        const ring: React.CSSProperties = { position: "absolute", inset: 0, borderRadius: "50%", boxSizing: "border-box" };
        // inside the kept lens the film stays lit after the relay is off: the lit spot
        const bright = closing ? Math.max(light.film, lerp(light.film, SPOT, light.off)) : light.film;
        return (
          <div key={b.id} style={{
            position: "absolute", left: st.x - d / 2, top: st.y - d / 2, width: d, height: d,
            transform: grow < 1 ? `scale(${grow})` : undefined, opacity: b.kept ? undefined : op,
          }}>
            {/* 6 px dim(0.5) outer ring instead of a drop shadow */}
            <div style={{ ...ring, inset: -6, border: `6px solid ${dim(0.5)}` }} />
            {/* lens content: the SAME grayscale film (FilmView -> films[] only) at camera s x lens, nothing else */}
            {st.lens > 1.001 || closing ? (
              <div style={{ ...ring, overflow: "hidden", background: C.graphite }}>
                <div style={{ position: "absolute", inset: 0, background: lightbox(light.fill) }} />
                <div style={{ position: "absolute", left: -(st.x - d / 2), top: -(st.y - d / 2), width: 1080, height: 1920 }}>
                  <FilmView dir={r.dir} films={r.films} view={lensView} videoFrame={videoFrameAt(r, frame)} brightness={bright} />
                </div>
              </div>
            ) : null}
            {/* rim: 4 px white, cross-fading to accent on the last word; it breathes in the closing hold */}
            <div style={{ ...ring, border: `${RIM}px solid ${C.white}`, opacity: op * (1 - accentK) }} />
            {accentK > 0 ? <div style={{ ...ring, border: `${RIM}px solid ${C.accent}`, opacity: op * accentK }} /> : null}
            {/* one 14 px accent dot on the rim at 45 deg */}
            <div style={{
              position: "absolute", left: d / 2 + dotR * Math.cos(a) - 7, top: d / 2 + dotR * Math.sin(a) - 7, width: 14, height: 14,
              borderRadius: "50%", background: C.accent, opacity: op,
            }} />
          </div>
        );
      })}
    </>
  );
};
