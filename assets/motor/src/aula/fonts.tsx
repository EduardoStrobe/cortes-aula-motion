// Manrope 600 / 400 loaded BY FILE with FontFace (the files' internal family name is unreliable), gated with
// delayRender. Also measures the font's vertical metrics so text can be placed by cap-top / cap-centre.
// ENGINE-OWNED. Element authors: use <Txt> and textWidth() instead of hand-placing text.
import React, { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { C, FONT, W } from "./tokens";

/** Vertical metrics in em (overwritten with values measured in the browser once the fonts are in). */
export const METRICS = { asc: 1.066, desc: 0.3, cap: 0.72, xh: 0.54 };

let ready = false;
let promise: Promise<void> | null = null;

const measureMetrics = () => {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return;
  ctx.font = `600 200px ${FONT}`;
  const m = ctx.measureText("H");
  const x = ctx.measureText("x");
  if (m.fontBoundingBoxAscent > 0) {
    METRICS.asc = m.fontBoundingBoxAscent / 200;
    METRICS.desc = m.fontBoundingBoxDescent / 200;
    METRICS.cap = m.actualBoundingBoxAscent / 200;
    METRICS.xh = x.actualBoundingBoxAscent / 200;
  }
};

export const loadFonts = (): Promise<void> => {
  if (promise) return promise;
  const faces = [
    new FontFace("Manrope", `url(${staticFile("fonts/Manrope-SemiBold.ttf")}) format("truetype")`, { weight: "600", style: "normal" }),
    new FontFace("Manrope", `url(${staticFile("fonts/Manrope-Regular.ttf")}) format("truetype")`, { weight: "400", style: "normal" }),
  ];
  promise = Promise.all(faces.map((f) => f.load())).then((loaded) => {
    loaded.forEach((f) => (document.fonts as unknown as { add(face: FontFace): void }).add(f));
    measureMetrics();
    ready = true;
  });
  return promise;
};

/** true once both weights are usable. Holds the render (delayRender) until then. */
export const useFontsReady = (): boolean => {
  const [ok, setOk] = useState(ready);
  const [handle] = useState(() => (ready ? null : delayRender("Aula: loading Manrope")));
  useEffect(() => {
    let alive = true;
    loadFonts()
      .then(() => {
        if (alive) setOk(true);
        if (handle !== null) continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
  }, [handle]);
  return ok;
};

/** Distance from the top of a line box of height `size` (line-height = 1) down to the cap-top. */
export const capOffset = (size: number) => ((1 - (METRICS.asc + METRICS.desc)) / 2 + METRICS.asc - METRICS.cap) * size;
export const capHeight = (size: number) => METRICS.cap * size;

export type Weight = 600 | 400;
export interface TextStyle { size: number; weight?: Weight; tracking?: number; caps?: boolean }

/** Width in px of one line of text (Manrope must be loaded: only call from components rendered by AulaCut).
 *  `tracking` in em. The trailing letter-spacing is NOT included. */
export const textWidth = (text: string, st: TextStyle): number => {
  const t = st.caps ? text.toUpperCase() : text;
  if (!t) return 0;
  const ls = (st.tracking ?? 0) * st.size;
  const w = measureText({
    text: t, fontFamily: "Manrope", fontSize: st.size, fontWeight: String(st.weight ?? 600),
    letterSpacing: `${ls}px`, validateFontIsLoaded: false,
  }).width;
  return w - ls;
};

/** Largest size <= `size` (never below `floor`) at which `text` is at most `maxWidth` wide. */
export const fitSize = (text: string, st: TextStyle, maxWidth: number, floor = 1): number => {
  const w = textWidth(text, st);
  if (w <= maxWidth) return st.size;
  return Math.max(floor, Math.floor((st.size * maxWidth) / w));
};

export interface TxtProps extends TextStyle {
  /** horizontal placement (screen px): exactly one of x (left edge), right (right edge) or cx (centre). */
  x?: number; right?: number; cx?: number;
  /** vertical placement (screen px): exactly one of capTop, capCenter or baseline. */
  capTop?: number; capCenter?: number; baseline?: number;
  color?: string; opacity?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}
/** One absolutely positioned line of Manrope, placed by its cap height (so "centre y 282" means the capitals'
 *  centre). Coordinates are relative to the nearest positioned ancestor (the engine layers use canvas px). */
export const Txt: React.FC<TxtProps> = ({ x, right, cx, capTop, capCenter, baseline, size, weight = 600, tracking = 0,
  caps, color = C.white, opacity, style, children }) => {
  const top0 = capTop !== undefined ? capTop : capCenter !== undefined ? capCenter - capHeight(size) / 2
    : (baseline ?? 0) - capHeight(size);
  const ls = tracking * size;
  const pos: React.CSSProperties = right !== undefined
    ? { right: W - right, marginRight: -ls }
    : cx !== undefined ? { left: cx, transform: "translateX(-50%)", paddingLeft: ls } : { left: x ?? 0 };
  return (
    <div style={{
      position: "absolute", top: top0 - capOffset(size), height: size, lineHeight: `${size}px`, fontFamily: FONT,
      fontSize: size, fontWeight: weight, letterSpacing: ls, textTransform: caps ? "uppercase" : "none",
      whiteSpace: "pre", color, opacity, fontSynthesis: "none", ...pos, ...style,
    }}>{children}</div>
  );
};
