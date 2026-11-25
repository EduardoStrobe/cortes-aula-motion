// c1 "moeda" — cut module. OWNER: the c1 cut author.
//
// Prop = CoinProp (SYSTEM 8.22): line-art disc, circle r 0.46 + inner rim circle r 0.36, a 30 deg accent arc on the
// rim. 2 px white strokes, transparent fill, no lettering, no value. It only draws inside its box; the host
// (engine token / PropCard / Prop element) positions it, pops it in and performs "fly".
//
// The coin is drawn as a real 3-D object in orthographic projection instead of a CSS rotateY (a CSS-rotated SVG
// vanishes at 90 deg and squashes its strokes): the faces are ellipses of rx = r * |cos|, the coin has a small
// thickness (two faces joined at top and bottom), and every stroke keeps its pixel width at any angle.
//
// Moves (durations in frames, overridable with `dur`):
//   flip   rotateY += args.turns (degrees, default 180; c1 film: 540) over 14 f, quadratic ease-out, with a small
//          toss (the drawing rises and falls inside / just above its box: 7 % of the box per half turn, max 14 %)
//   edge   rotateY -> the next edge-on angle (.. 90, 270 ..) over 14 f INOUT; over the last 30 % the thickness
//          closes and the stroke goes 2 -> 3 px, so it ends as ONE 3 px vertical line (SYSTEM 8.22)
//   face   rotateY -> the next face-on angle with the FRONT face to the viewer (multiple of 360; from an edge-on
//          90 it turns back to 0) over 10 f OUT
//   fly    performed by the host (Prop element); ignored here, like every unknown name
// Idle: the accent arc slowly travels round the rim (one turn in 8 s), so the token is never a dead pixel.
// Film / card placements only: after a `flip` has landed the coin keeps swaying gently about its vertical axis
// (+-32 deg, 44 f period, eased in over 10 f) until the next move, so the big coin is never a frozen drawing while
// it waits; `face` (or `edge`) takes over from wherever the sway is. The 48-84 px token does not sway.
// Film placement adds a dim(0.5) under-stroke (the legibility aid SYSTEM 1 gives to marks on film).
// Boxes of 110 px and more (film, card) also get a milled edge: 30 short 1.5 px ticks at 72 % white in the band
// between the rim and the outer circle (no lettering, no value). Without it the big coin read as "two rings" at
// phone size; the 48-84 px token stays exactly the SYSTEM 8.22 drawing.
//
// REVIEW ROUND 1 (the client asked for a real coin moment; the reviewers saw "a hollow thin-line disc"): big
// placements (box >= 110 px, film / card) are now a SOLID coin: graphite face and edge fills, strokes that grow with
// the box (2 px at 150 px, 5 px at 400 px), a neutral relief (two arcs on the front, a ring on the back: no
// lettering, no value) and a light band that crosses the face while it turns. The fills and the relief fade out
// during a `face` move (c1: the fly to the object), so the coin LANDS as the transparent line drawing of SYSTEM
// 8.22 and the radiographic object shows through it. The 48-84 px token is unchanged.
//
// LOOKS ("branco", rp-c1-branco): the storyboard's looks block parks the token beside the hook headline at 220 px
// (hook.tokenHome). A token box above 86 px is the HERO TOKEN of the approved first-frame mockup: accent outer
// circle, dotted rim, a "?" in the ink colour (see `hero` in Prop). The default look's token is 48..84 px and never
// reaches that branch, so rp-c1 is unchanged. Everything else of this module is drawn inside the (dark) stage with
// the live C / dim() tokens and needs nothing per look.
//
// elements = cut-specific extra elements: Divider (c1.md beat 9b), LockCard (locked treatment of a cover).
import React from "react";
import {
  C, clamp01, defineElement, dim, INOUT, lerp, OUT, PropSvg, Txt,
  type ElementDef, type PropComponent, type PropMove,
} from "../elements/api";

// ---- pose (pure function of the move list and the frame) ----------------------------------------------------------
interface Pose {
  /** rotateY in degrees (accumulates over moves) */
  deg: number;
  /** 0 = coin with thickness, 1 = collapsed to a single 3 px line (resting edge-on) */
  thin: number;
  /** toss height, fraction of the box */
  hop: number;
}
const DUR: Record<string, number> = { flip: 14, edge: 14, face: 10 };
const SWAY = { amp: 32, period: 44, ramp: 10 };
const quadOut = (t: number) => 1 - (1 - t) * (1 - t);
const smooth = (a: number, b: number, t: number) => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Pose reached by `m` at frame `f`, starting from `from` (the pose on the move's first frame). */
const step = (from: Pose, m: PropMove, f: number): Pose => {
  const dur = Math.max(1, m.dur ?? DUR[m.name]);
  const p = clamp01((f - m.at) / dur);
  if (m.name === "flip") {
    const turns = typeof m.args?.turns === "number" ? (m.args.turns as number) : 180;
    const amp = Math.min(0.14, 0.07 * Math.max(1, Math.abs(turns) / 270));
    return { deg: from.deg + turns * quadOut(p), thin: from.thin * (1 - smooth(0, 0.3, p)), hop: amp * Math.sin(Math.PI * p) };
  }
  if (m.name === "edge") {
    const to = Math.ceil((from.deg - 90) / 180 - 1e-9) * 180 + 90;
    return { deg: lerp(from.deg, to, INOUT(p)), thin: Math.max(from.thin, smooth(0.7, 1, p)), hop: 0 };
  }
  // face
  const to = Math.ceil((from.deg - 90) / 360 - 1e-9) * 360;
  return { deg: lerp(from.deg, to, OUT(p)), thin: from.thin * (1 - smooth(0, 0.3, p)), hop: 0 };
};

/** Idle sway after a landed flip (film / card placements): starts at 0, so the pose stays continuous. */
const swayDeg = (m: PropMove, f: number): number => {
  if (m.name !== "flip") return 0;
  const t = f - (m.at + Math.max(1, m.dur ?? DUR[m.name]));
  return t <= 0 ? 0 : SWAY.amp * Math.sin((2 * Math.PI * t) / SWAY.period) * clamp01(t / SWAY.ramp);
};

const poseAt = (moves: PropMove[], frame: number, sway: boolean): Pose => {
  const mine = moves.filter((m) => m.name in DUR && m.at <= frame).sort((a, b) => a.at - b.at);
  let pose: Pose = { deg: 0, thin: 0, hop: 0 };
  mine.forEach((m, i) => {
    // a later move starts from wherever this one had got to on that frame
    const f = i + 1 < mine.length ? mine[i + 1].at : frame;
    pose = step(pose, m, f);
    if (sway) pose = { ...pose, deg: pose.deg + swayDeg(m, f) };
  });
  return pose;
};

// ---- drawing -----------------------------------------------------------------------------------------------------
const R_OUT = 0.46;
const R_RIM = 0.36;
const THICK = 0.055;
const ARC_DEG = 30;
// milled edge: REED_N ticks between REED_R0 and REED_R1, only when the box is at least REED_MIN_SIZE px
const REED_N = 30;
const REED_R0 = 0.387;
const REED_R1 = 0.433;
const REED_MIN_SIZE = 110;
const R_RELIEF = 0.24;
// hero token (looks): the box size above which the token is drawn as the mockup's coin, and its number of rim dots
const HERO_MIN = 86;
const HERO_DOTS = 40;
const n4= (v: number) => Math.round(v * 10000) / 10000;

export const Prop: PropComponent = ({ size, frame, moves, placement, color = C.white, accent = C.accent }) => {
  const uid = React.useId().replace(/[^A-Za-z0-9_-]/g, "");
  const pose = poseAt(moves, frame, placement !== "token");
  const rad = (pose.deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const k = Math.abs(cos);
  const front = cos >= 0;
  const px = 1 / Math.max(1, size);

  // big placements: a solid coin. `solid` goes 1 -> 0 over the last `face` move (the fly to the object).
  const big = placement !== "token" && size >= REED_MIN_SIZE;
  let solid = big ? 1 : 0;
  if (big) {
    const fm = [...moves].reverse().find((m) => m.name === "face" && m.at <= frame);
    if (fm) solid = 1 - smooth(0.1, 0.8, (frame - fm.at) / Math.max(1, fm.dur ?? DUR.face));
  }
  const wMain = big ? Math.min(5, Math.max(2, size / 80)) : 2;

  const half = (THICK / 2) * (1 - pose.thin) * sin;
  const xn = 0.5 + (front ? half : -half); // centre of the face turned to the viewer
  const xf = 0.5 - (front ? half : -half); // centre of the face turned away
  const cy = 0.5 - pose.hop;
  const rxOut = Math.max(R_OUT * k, 0.3 * px);
  const rxRim = R_RIM * k;
  const top = cy - R_OUT;
  const bot = cy + R_OUT;
  const strokePx = lerp(wMain, wMain + 1, pose.thin);

  // far face: only its outer half shows, joined to the near face at top and bottom (the coin's edge)
  const gap = Math.abs(xn - xf);
  const edgePath = gap > 0.2 * px
    ? `M ${n4(xn)} ${n4(top)} L ${n4(xf)} ${n4(top)} A ${n4(rxOut)} ${R_OUT} 0 0 ${xf < xn ? 0 : 1} ${n4(xf)} ${n4(bot)} L ${n4(xn)} ${n4(bot)}`
    : null;

  // accent arc on the rim: 30 deg, travelling slowly clockwise; mirrored on the back face
  const a0 = 20 + frame * 1.5;
  const mirror = front ? 1 : -1;
  const facePt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${n4(xn + mirror * r * k * Math.sin(a))} ${n4(cy - r * Math.cos(a))}`;
  };
  const arcPts: string[] = [];
  for (let i = 0; i <= 6; i++) arcPts.push(`${i === 0 ? "M" : "L"} ${facePt(R_RIM, a0 + (ARC_DEG * i) / 6)}`);
  const rimOn = rxRim > 1.2 * px;
  const rimOpacity = clamp01((rxRim / px - 1.2) / 3);

  // milled edge (big placements only): short radial ticks in the band between the rim and the outer circle. They
  // are part of the face, so they foreshorten with it; this is what makes two circles read as a COIN on a phone.
  let reedPath: string | null = null;
  const reedOpacity = size >= REED_MIN_SIZE ? clamp01((k - 0.18) / 0.3) * rimOpacity : 0;
  if (reedOpacity > 0.01) {
    const parts: string[] = [];
    for (let i = 0; i < REED_N; i++) {
      const a = ((i + 0.5) * 2 * Math.PI) / REED_N;
      const sx = Math.sin(a) * k * mirror;
      const cyo = Math.cos(a);
      parts.push(`M ${n4(xn + REED_R0 * sx)} ${n4(cy - REED_R0 * cyo)} L ${n4(xn + REED_R1 * sx)} ${n4(cy - REED_R1 * cyo)}`);
    }
    reedPath = parts.join(" ");
  }

  // relief (solid coin only): front = two facing arcs, back = a ring. Neutral ornament, never a value or a letter.
  let relief: React.ReactNode = null;
  if (solid > 0.01 && rimOn) {
    const arc = (d0: number, d1: number) => {
      const pts: string[] = [];
      for (let i = 0; i <= 10; i++) pts.push(`${i === 0 ? "M" : "L"} ${facePt(R_RELIEF, d0 + ((d1 - d0) * i) / 10)}`);
      return pts.join(" ");
    };
    relief = front
      ? <path d={`${arc(28, 152)} ${arc(208, 332)}`} />
      : <ellipse cx={n4(xn)} cy={n4(cy)} rx={n4(0.17 * k)} ry={0.17} />;
  }

  // light band crossing the face while it turns (clipped to the face; off the face when it rests face-on)
  const u = (((pose.deg / 180) % 1) + 1) % 1;
  const xs = xn + rxOut * 1.6 * (2 * u - 1);
  const bw = 0.2 * Math.max(k, 0.25);
  const lean = 0.1;
  const shine = `M ${n4(xs - bw / 2 + lean)} ${n4(top)} L ${n4(xs + bw / 2 + lean)} ${n4(top)} L ${n4(xs + bw / 2 - lean)} ${n4(bot)} L ${n4(xs - bw / 2 - lean)} ${n4(bot)} Z`;

  // [looks] HERO TOKEN: the token parked beside the hook headline (hook.tokenHome, "branco": 220 px). The default
  // token never leaves 48..84 px, so nothing below runs for it. Drawn as the coin of the approved first-frame mockup:
  // outer circle (and the coin's edge) in the accent, the rim as a slowly turning dotted circle and a "?" in the
  // text colour (the cut's neutral question: "cadê a pegadinha?"; never a value, never a letter of a word). `hero`
  // goes 1 -> 0 while the token shrinks on its flight to the HUD, where it is the SYSTEM 8.22 line drawing again.
  const hero = placement === "token" && size > HERO_MIN ? smooth(HERO_MIN, 150, size) : 0;
  if (hero > 0) {
    const w = lerp(2, Math.min(6, Math.max(3, size / 38)), hero);
    const ring = (stroke: string, opacity: number) => (
      <g stroke={stroke} strokeWidth={lerp(w, w + 1, pose.thin) * px} opacity={opacity}>
        {edgePath ? <path d={edgePath} /> : null}
        <ellipse cx={n4(xn)} cy={n4(cy)} rx={n4(rxOut)} ry={R_OUT} />
      </g>
    );
    const glyph = 0.3 * size;
    return (
      <>
        <PropSvg size={size}>
          {() => (
            <>
              {ring(color, 1 - hero)}
              {ring(accent, hero)}
              {rimOn ? (
                <g stroke={color} strokeWidth={Math.max(2, w * 0.55) * px} opacity={rimOpacity}>
                  <ellipse cx={n4(xn)} cy={n4(cy)} rx={n4(rxRim)} ry={R_RIM} opacity={1 - hero} />
                  <ellipse cx={n4(xn)} cy={n4(cy)} rx={n4(rxRim)} ry={R_RIM} opacity={hero} pathLength={HERO_DOTS}
                    strokeDasharray="0.02 0.98" strokeDashoffset={n4(-frame * 0.012)} />
                </g>
              ) : null}
              {rimOn ? <path d={arcPts.join(" ")} stroke={accent} strokeWidth={(w + 1) * px} opacity={rimOpacity * (1 - hero)} /> : null}
            </>
          )}
        </PropSvg>
        {hero > 0.02 && rimOn ? (
          <Txt cx={xn * size} capCenter={cy * size} size={glyph} color={color} opacity={hero * rimOpacity}
            style={{ transform: `translateX(-50%) scaleX(${n4(Math.max(k, 0.02))})`, transformOrigin: "50% 50%" }}>?</Txt>
        ) : null}
      </>
    );
  }

  const shape = (stroke: string, w: number, top: boolean) => (
    <g stroke={stroke} strokeWidth={w * px} fill="none">
      {top && solid > 0 && edgePath ? <ellipse cx={n4(xf)} cy={n4(cy)} rx={n4(rxOut)} ry={R_OUT} fill={C.graphite} fillOpacity={solid} stroke="none" /> : null}
      {edgePath ? <path d={edgePath} /> : null}
      <ellipse cx={n4(xn)} cy={n4(cy)} rx={n4(rxOut)} ry={R_OUT} fill={top && solid > 0 ? C.graphite2 : "none"} fillOpacity={0.96 * solid} />
      {top && solid > 0.01 ? (
        <g clipPath={`url(#rp-coin-${uid})`} stroke="none">
          <path d={shine} fill={C.white} fillOpacity={0.16 * solid} />
        </g>
      ) : null}
      {rimOn ? <ellipse cx={n4(xn)} cy={n4(cy)} rx={n4(rxRim)} ry={R_RIM} opacity={rimOpacity} /> : null}
      {top && reedPath ? <path d={reedPath} strokeWidth={Math.max(1.5, w * 0.6) * px} opacity={0.72 * reedOpacity} /> : null}
      {top && relief ? <g strokeWidth={w * 0.8 * px} opacity={0.6 * solid * rimOpacity}>{relief}</g> : null}
      {rimOn && top ? <path d={arcPts.join(" ")} stroke={accent} strokeWidth={(w + 1) * px} opacity={rimOpacity} /> : null}
    </g>
  );

  return (
    <PropSvg size={size}>
      {() => (
        <>
          {big ? (
            <defs>
              <clipPath id={`rp-coin-${uid}`}><ellipse cx={n4(xn)} cy={n4(cy)} rx={n4(rxOut)} ry={R_OUT} /></clipPath>
            </defs>
          ) : null}
          {placement === "film" ? shape(dim(0.5), strokePx + 3, false) : null}
          {shape(color, strokePx, true)}
        </>
      )}
    </PropSvg>
  );
};

// ---- Divider (c1.md beat 9b) -------------------------------------------------------------------------------------
// 1 px horizontal hairline in SLIDE space between the two rows (the two cases), drawn left to right.
interface DividerProps { y: number; x0: number; x1: number; draw?: number }
const Divider = defineElement<DividerProps>({
  defaultUntil: "closing",
  Slide: ({ ctx }) => {
    const { x0, x1, y, draw } = ctx.props;
    const t = ctx.ease.prog(ctx.frame + 1, ctx.at, draw ?? 14, ctx.ease.INOUT);
    if (t <= 0) return null;
    return (
      <line x1={x0} y1={y} x2={x0 + (x1 - x0) * t} y2={y} stroke={ctx.tokens.C.text2} strokeOpacity={0.42}
        strokeWidth={ctx.px(1)} strokeLinecap="round" />
    );
  },
});

// ---- LockCard (review: "the right half of the stage is two empty locked cards") ----------------------------------
// Locked treatment drawn ON a cover (SLIDE layer: above the engine's cover card, below its label chip). The cover
// stays what it is, an opaque card over a profile film that is never rendered; this only makes it read as LOCKED
// CONTENT instead of an empty box: slowly drifting diagonal hatch, a light band that crosses the card now and then,
// and a large padlock (accent keyhole) that rocks on its own every 45 f, rocks harder with the cover's shakes and
// swells with its label pops / pulses. Before the cover's label is on, the padlock sits in the middle of the card
// (and hides the engine's 24 px glyph); when the label pops it moves up and leaves the centre to the label.
// It follows the engine's locked shake (same 6 px, 12 f) so card, hatch and padlock move as one.
interface LockCardProps { cover: string; phase?: number }
const LOCK = { size: 140, lift: 112, hatch: 26, idle: 45 };
const LockCard = defineElement<LockCardProps>({
  defaultUntil: "end",
  Slide: ({ ctx }) => {
    const { frame, at, props, ease, tokens: { C: K } } = ctx;
    const cv = ctx.r.covers.find((c) => c.id === props.cover);
    if (!cv) throw new Error(`[aula] LockCard "${ctx.beat.id}": no cover "${props.cover}"`);
    const appear = ease.prog(frame + 1, at, 8);
    if (appear <= 0) return null;
    const phase = props.phase ?? 0;
    const [x0, y0, x1, y1] = cv.rect;
    const w = x1 - x0;
    const h = y1 - y0;
    let dx = 0;
    let rock = 0;
    for (const s of cv.shakes) {
      const d = frame - s;
      if (d >= 0 && d < 12) {
        dx = ctx.px(6 * Math.sin((d / 12) * Math.PI * 6));
        rock = 12 * Math.sin((d / 12) * Math.PI * 4);
      }
    }
    const idle = (((frame - at - phase) % LOCK.idle) + LOCK.idle) % LOCK.idle;
    if (rock === 0 && idle < 12) rock = 5 * Math.sin((idle / 12) * Math.PI * 2);
    const swell = 1 + 0.12 * ease.bumps(frame, [cv.at, ...cv.pulses, ...cv.shakes], 10);
    const up = ease.pop(frame - cv.at + 1);
    const cx = (x0 + x1) / 2;
    const ly = (y0 + y1) / 2 - LOCK.lift * up;
    const L = LOCK.size;
    const id = `rp-lock-${ctx.beat.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
    const inset = ctx.px(1.5);
    // hatch: 45 deg lines drifting to the right
    const off = (((frame * 0.4 + phase) % LOCK.hatch) + LOCK.hatch) % LOCK.hatch;
    const lines: string[] = [];
    for (let x = x0 - h + off; x < x1; x += LOCK.hatch) lines.push(`M ${x} ${y1} L ${x + h} ${y0}`);
    // light band: crosses the card in 36 f, every 96 f
    const t = (((frame + phase * 2) % 96) + 96) % 96;
    const bx = x0 - h - 80 + ((w + h + 160) * t) / 36;
    const band = t < 36 ? `M ${bx} ${y1} L ${bx + 70} ${y1} L ${bx + 70 + h} ${y0} L ${bx + h} ${y0} Z` : null;
    const sw = ctx.px(4);
    return (
      <g opacity={appear} transform={`translate(${dx} 0)`}>
        <defs>
          <clipPath id={id}><rect x={x0 + inset} y={y0 + inset} width={w - 2 * inset} height={h - 2 * inset} rx={ctx.px(15)} /></clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
          <rect x={x0} y={y0} width={w} height={h} fill={K.graphite2} />
          <path d={lines.join(" ")} stroke={K.white} strokeOpacity={0.06} strokeWidth={ctx.px(2)} fill="none" />
          {band ? <path d={band} fill={K.white} fillOpacity={0.05} /> : null}
        </g>
        <g transform={`rotate(${rock} ${cx} ${ly + 0.2 * L}) translate(${cx} ${ly}) scale(${swell}) translate(${-cx} ${-ly})`}>
          <path d={`M ${cx - 0.19 * L} ${ly - 0.02 * L} V ${ly - 0.24 * L} A ${0.19 * L} ${0.19 * L} 0 0 1 ${cx + 0.19 * L} ${ly - 0.24 * L} V ${ly - 0.02 * L}`}
            fill="none" stroke={K.text2} strokeWidth={sw} strokeLinecap="round" />
          <rect x={cx - 0.31 * L} y={ly - 0.04 * L} width={0.62 * L} height={0.46 * L} rx={0.08 * L}
            fill={K.graphite} stroke={K.text2} strokeWidth={sw} />
          <circle cx={cx} cy={ly + 0.14 * L} r={0.05 * L} fill={K.accent} />
          <path d={`M ${cx} ${ly + 0.16 * L} V ${ly + 0.28 * L}`} stroke={K.accent} strokeWidth={sw} strokeLinecap="round" />
        </g>
      </g>
    );
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const elements: Record<string, ElementDef<any>> = { Divider, LockCard };
