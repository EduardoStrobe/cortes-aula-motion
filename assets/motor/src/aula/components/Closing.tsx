// Closing, common part after T (SYSTEM 10.3): CTA line in Zcta and the lockup in the caption band.
// (Film dim, stage shrink, kept marks, prop callback and the end question live in Stage / timeline / Hud.)
// Timings: tokens.CLOSING_T. ENGINE-OWNED.
import React from "react";
import { Txt, textWidth } from "../fonts";
import { inkAt } from "../look";
import type { Resolved } from "../resolve";
import { stageAt } from "../timeline";
import { bump, clamp01, CLOSING_T, H, lerp, OUT, prog, W, Z } from "../tokens";
import { Logo, logoCardPad, logoWidth } from "./Looks";

const row = (Cf: number, start: number) => {
  const p = prog(Cf, start, 6, OUT);
  return { opacity: p, style: { transform: `translateY(${24 * (1 - p)}px)` } as React.CSSProperties };
};

export const CTA_TEXT = { l1: "A resposta está", l2a: "na ", l2b: "aula completa", l2c: "." };

/** CTA line: Z.cta (72 px, 2 lines, pitch 78, first cap-top y 1078, left x 60); "aula completa" sweeps to accent.
 *  The rows enter at C 22 / 25, i.e. AFTER the stage's bottom edge (C 10..26) has passed their place: at C 14 / 17
 *  line 1 was cut by the still-moving edge for 3-6 frames in every cut. The clip below stays as a safety net. */
export const Cta: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const Cf = frame - r.T - r.ctaShift;
  if (Cf < CLOSING_T.cta1) return null;
  const a = row(Cf, CLOSING_T.cta1);
  const b = row(Cf, CLOSING_T.cta2);
  const sweep = prog(Cf, CLOSING_T.sweep, 8);
  const st = { size: Z.cta.size, tracking: -0.01 };
  const edge = stageAt(r, frame).bottom + 10;
  const ink = inkAt(r.look, Z.cta.capTop + Z.cta.pitch);
  const tab = ink.word.mode === "tab" ? ink.word : null;
  const acc = tab ? tab.text : ink.word.mode === "colour" ? ink.word.color : ink.text;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, clipPath: `inset(${edge}px 0px 0px 0px)` }}>
      <Txt x={Z.cta.x0} capTop={Z.cta.capTop} {...st} color={ink.text} opacity={a.opacity} style={a.style}>{CTA_TEXT.l1}</Txt>
      <Txt x={Z.cta.x0} capTop={Z.cta.capTop + Z.cta.pitch} {...st} color={ink.text} opacity={b.opacity} style={b.style}>
        {CTA_TEXT.l2a}
        {/* [looks] tab mode: a tab grows behind the phrase with the sweep and pushes the full stop clear of it */}
        <span style={{ position: "relative", display: "inline-block", margin: tab ? `0 ${0.16 * sweep}em 0 0.12em` : undefined }}>
          {tab && sweep > 0 ? (
            <span style={{
              position: "absolute", left: "-0.14em", right: "-0.14em", top: "0.04em", bottom: "-0.1em", borderRadius: "0.14em",
              background: tab.fill, clipPath: sweep < 1 ? `inset(0px ${(1 - sweep) * 100}% 0px 0px)` : undefined,
            }} />
          ) : null}
          <span style={{
            position: tab ? "relative" : undefined,
            color: sweep >= 1 ? acc : ink.text,
            clipPath: sweep > 0 && sweep < 1 ? `inset(-40% -2% -40% ${sweep * 100}%)` : undefined,
          }}>{CTA_TEXT.l2b}</span>
          {sweep > 0 && sweep < 1 ? (
            <span style={{ position: "absolute", left: 0, top: 0, color: acc, clipPath: `inset(-40% ${(1 - sweep) * 100}% -40% -2%)` }}>
              {CTA_TEXT.l2b}
            </span>
          ) : null}
        </span>
        {CTA_TEXT.l2c}
      </Txt>
    </div>
  );
};

const LOCK = {
  x: Z.caption.x0, right: Z.caption.x1,
  name: "Nome do Apresentador",
  lesson: ["Nome da aula", "e segmentação pulmonar"],
  pill: "ASSISTA À AULA COMPLETA",
};
/** Pill (the button of the end card). Review: white 30 px text on the light-blue gradient measured 2.4-3.2 : 1 and
 *  the pill was the smallest element of the card. Now graphite text (about 7 : 1), 72 px high, 32 px type, and it
 *  lands with a bump and pulses once more in the hold so the last 2 s are not a frozen card. */
const PILL = { h: 72, top: 1390, size: 32, tracking: 0.08, dot: 12, dotGap: 14, pad: 30 };

/** Lockup (x 316-956, right of the camera block): name, lesson name, CTA pill growing from a circle, logo on the
 *  name row. */
export const Lockup: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const Cf = frame - r.T;
  if (Cf < CLOSING_T.name) return null;
  const n = row(Cf, CLOSING_T.name);
  const l = row(Cf, CLOSING_T.lesson);
  const avail = LOCK.right - LOCK.x;
  // type shrinks before the pill would pass x 956
  let size = PILL.size;
  const fullAt = (sz: number) => 2 * PILL.pad + PILL.dot + PILL.dotGap + textWidth(LOCK.pill, { size: sz, tracking: PILL.tracking, caps: true });
  while (size > 26 && fullAt(size) > avail) size--;
  const pillSt = { size, tracking: PILL.tracking, caps: true };
  const full = Math.min(fullAt(size), avail);
  // the pill follows the CTA rows (c1's swapTo closing runs 4 f later)
  const Cp = Cf - r.ctaShift;
  const grow = prog(Cp, CLOSING_T.pill, 10, OUT);
  const w = lerp(PILL.h, full, grow);
  const textOp = prog(Cp, CLOSING_T.pillText, 6);
  // landing bump + one pulse in the hold (scale about the pill's left-centre so it never passes x 956 by more
  // than the bump itself: 5 % of 600 px = 30 px, still left of x 1040 and it carries no text there)
  const beat = Math.max(bump(Cp, CLOSING_T.pillLand, 10), bump(Cp, CLOSING_T.pillPulse, 12));
  const pillScale = 1 + 0.05 * beat;
  const dotPulse = 1 + 0.6 * beat;
  const logoH = 36;
  const logoW = logoWidth(logoH);
  // [looks] colours of the surface the lockup sits on; a carded logo keeps the CARD's edge on the right margin
  const ink = inkAt(r.look, 1300);
  const logoPad = ink.logo.card ? logoCardPad(logoH).px : 0;
  return (
    <>
      <Txt x={LOCK.x} capCenter={1272} size={40} color={ink.text} opacity={n.opacity} style={n.style}>{LOCK.name}</Txt>
      <Txt x={LOCK.x} capCenter={1319} size={30} weight={400} color={ink.text2} opacity={l.opacity} style={l.style}>{LOCK.lesson[0]}</Txt>
      <Txt x={LOCK.x} capCenter={1357} size={30} weight={400} color={ink.text2} opacity={l.opacity} style={l.style}>{LOCK.lesson[1]}</Txt>
      {Cp >= CLOSING_T.pill ? (
        <div style={{
          position: "absolute", left: LOCK.x, top: PILL.top, width: w, height: PILL.h, borderRadius: PILL.h / 2, background: ink.pill.fill,
          overflow: "hidden", opacity: clamp01((Cp - CLOSING_T.pill + 1) / 3),
          transform: `scale(${pillScale})`, transformOrigin: "0% 50%",
        }}>
          <div style={{
            position: "absolute", left: PILL.pad, top: (PILL.h - PILL.dot) / 2, width: PILL.dot, height: PILL.dot, borderRadius: PILL.dot / 2,
            background: ink.pill.text, opacity: textOp, transform: `scale(${dotPulse})`,
          }} />
          <Txt x={PILL.pad + PILL.dot + PILL.dotGap} capCenter={PILL.h / 2} {...pillSt} color={ink.pill.text} opacity={textOp}>{LOCK.pill}</Txt>
        </div>
      ) : null}
      <Logo file={ink.logo.file} card={ink.logo.card} left={LOCK.right - logoPad - logoW} top={1254} h={logoH}
        opacity={prog(Cf, CLOSING_T.logo, 8)} />
    </>
  );
};
