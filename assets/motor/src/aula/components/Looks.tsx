// Pieces that only the LOOKS use (ENGINE.md "Looks"): the Marca wordmark in its two files (with or without a
// white card), the hook logo, the hook pills ("CERTO" / "ERRADO") and the graphite scrims of a full-bleed stage.
// ENGINE-OWNED. Nothing here is mounted by the default look except <Logo> in its plain white form.
import React from "react";
import { Img, staticFile } from "remotion";
import { Txt, textWidth } from "../fonts";
import { inkAt } from "../look";
import type { Resolved } from "../resolve";
import type { Scrims } from "../timeline";
import { bump, clamp01, H, hexA, lerp, pop, prog, W } from "../tokens";

/** The wordmark art is 538 x 100. "branco" (white, for dark pages) is that exact size; "claro" (dark type, for
 *  light pages) is a 700 x 200 file with the art at (81, 50): it is cropped to the art here. */
const ART = { w: 538, h: 100 };
const CLARO = { w: 700, h: 200, x: 81, y: 50 };
export const logoWidth = (h: number) => Math.round((ART.w / ART.h) * h);
/** Padding of the white card round the art, as a share of the art height. */
const CARD = { px: 0.5, py: 0.42 };
export const logoCardPad = (h: number) => ({ px: Math.round(CARD.px * h), py: Math.round(CARD.py * h) });

/** The wordmark with its ART's top-left at (left, top) and art height h. With `card` a white rounded card is drawn
 *  round it (it extends logoCardPad(h) beyond the art on every side). */
export const Logo: React.FC<{ file: "branco" | "claro"; card: boolean; left: number; top: number; h: number; opacity?: number }> =
  ({ file, card, left, top, h, opacity }) => {
    const w = logoWidth(h);
    if (file === "branco" && !card) {
      return <Img src={staticFile("brand/logo-marca-branco.png")} style={{ position: "absolute", left, top, width: w, height: h, opacity }} />;
    }
    const k = h / ART.h;
    const pad = logoCardPad(h);
    return (
      <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
        {card ? (
          <div style={{
            position: "absolute", left: left - pad.px, top: top - pad.py, width: w + 2 * pad.px, height: h + 2 * pad.py,
            borderRadius: 0.45 * h, background: "#FFFFFF",
          }} />
        ) : null}
        {file === "branco" ? (
          <Img src={staticFile("brand/logo-marca-branco.png")} style={{ position: "absolute", left, top, width: w, height: h }} />
        ) : (
          <div style={{ position: "absolute", left, top, width: w, height: h, overflow: "hidden" }}>
            <Img src={staticFile("brand/logo-marca-fundo-claro.png")}
              style={{ position: "absolute", left: -CLARO.x * k, top: -CLARO.y * k, width: CLARO.w * k, height: CLARO.h * k, maxWidth: "none" }} />
          </div>
        )}
      </div>
    );
  };

/** Opacity of everything that lives with the kicker row during the hook (out over H - 3 .. H). */
const hookOpacity = (r: Resolved, frame: number) => 1 - prog(frame, r.H - 3, 3);

/** layout.hookLogo: the wordmark during the hook, in the logo variant of the surface it sits on. */
export const HookLogo: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const spec = r.look.layout.hookLogo;
  if (!spec || frame >= r.H) return null;
  const ink = inkAt(r.look, spec.cy);
  const w = logoWidth(spec.h);
  // `x` is the edge of the CARD when there is one, so a carded logo never passes the safe margin
  const pad = ink.logo.card ? logoCardPad(spec.h).px : 0;
  const left = spec.align === "right" ? spec.x - pad - w : spec.x + pad;
  return <Logo file={ink.logo.file} card={ink.logo.card} left={left} top={spec.cy - spec.h / 2} h={spec.h} opacity={hookOpacity(r, frame)} />;
};

const PILL = { h: 60, pad: 26, gap: 14, tracking: 0.08, stroke: 3 };
/** hook.pills: a row of pills beside the headline question. First pill filled, the rest outlined; they pop in
 *  3 f apart, then take turns pulsing (one every 18 f) so the row is never a still; out with the kicker. */
export const HookPills: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const spec = r.sb.hook.pills;
  if (!spec || r.pillsAt === null || frame >= r.H || frame < r.pillsAt) return null;
  const cy = spec.cy ?? 282;
  const ink = inkAt(r.look, cy);
  const size = spec.size ?? 30;
  const st = { size, tracking: PILL.tracking, caps: true };
  const ws = spec.labels.map((t) => textWidth(t, st) + 2 * PILL.pad);
  const total = ws.reduce((a, b) => a + b, 0) + PILL.gap * (ws.length - 1);
  let x = spec.x !== undefined ? spec.x : (spec.right ?? 960) - total;
  const op = hookOpacity(r, frame);
  const n = spec.labels.length;
  return (
    <>
      {spec.labels.map((t, i) => {
        const left = x;
        x += ws[i] + PILL.gap;
        const born = r.pillsAt! + 3 * i;
        // frame 0 is the poster: a row that starts there is already in place on it
        const k = r.pillsAt === 0 ? 1 : pop(frame - born + 1);
        const since = frame - (r.pillsAt! + 24);
        const turn = since >= 0 ? Math.floor(since / 18) : -1;
        const pulse = turn >= 0 && turn % n === i ? bump(since, turn * 18, 12) : 0;
        const filled = i === 0;
        return (
          <div key={i} style={{
            position: "absolute", left, top: cy - PILL.h / 2, width: ws[i], height: PILL.h, borderRadius: PILL.h / 2,
            boxSizing: "border-box", background: filled ? ink.text : "transparent",
            border: filled ? "none" : `${PILL.stroke}px solid ${ink.text}`,
            opacity: op * (r.pillsAt === 0 ? 1 : clamp01((frame - born + 1) / 3)),
            transform: `scale(${lerp(0.8, 1, k) * (1 + 0.06 * pulse)})`, transformOrigin: "50% 50%",
          }}>
            <Txt cx={ws[i] / 2 - (filled ? 0 : PILL.stroke)} capCenter={PILL.h / 2 - (filled ? 0 : PILL.stroke)} {...st}
              color={filled ? ink.onText : ink.text}>{t}</Txt>
          </div>
        );
      })}
    </>
  );
};

/** Scrims of a full-bleed stage: graphite from the top of the frame over the HUD row, and from the caption band
 *  up. Drawn INSIDE the stage clip, above the film / patches / covers and below every element layer. */
export const StageScrims: React.FC<{ s: Scrims; color: string }> = ({ s, color }) => {
  const c = (a: number) => hexA(color, a);
  return (
    <>
      <div style={{
        position: "absolute", left: 0, top: 0, width: W, height: s.top1,
        background: `linear-gradient(180deg, ${c(s.alpha)} 0px, ${c(s.alpha)} ${s.top0}px, ${c(0)} ${s.top1}px)`,
      }} />
      <div style={{
        position: "absolute", left: 0, top: s.b0, width: W, height: H - s.b0,
        background: `linear-gradient(180deg, ${c(0)} 0px, ${c(s.alpha)} ${s.b1 - s.b0}px, ${c(1)} ${s.b2 - s.b0}px)`,
      }} />
    </>
  );
};
