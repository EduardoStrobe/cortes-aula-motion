// c2 — cut module. OWNER: the c2 cut author.
//   Prop      BombomProp (SYSTEM 8.22): a wrapped candy in the brand's line-art style. 2 px white strokes, transparent
//             fill, ONE accent detail (the dot on the body). It only draws inside its square box; the host places it
//             and plays the entrance pop (token: engine; card: PropCard; film: the Prop element). The drawing is the
//             same in the three placements; only `size` changes (236 px beside the hook headline, 48 px in the HUD,
//             84 px in the closing kicker row, 132-150 px in a card, >= 130 px on film).
//   elements  BandFocus (review round 1): the pivotal question ("O que vocês estão achando das clavículas? ... E onde
//             é que está a clavícula?") was carried by four thin corners and a chip that repeated the caption.
//             BandFocus dims the film OUTSIDE one slide rect (the whole shoulder-girdle band, both sides: it never
//             singles out a side) and runs a searching scan line across the rect on given words. It is drawn in
//             the SLIDE layer, so chips and numerals (Screen layer) stay at full brightness, unlike under Spotlight.
//             FilmFeather, HookCurtain (look "tela-cheia" only, mounted through looks["tela-cheia"].addBeats): the
//             film's top / bottom edges melt into the page; a graphite curtain carries the hook headline from the
//             lower part of the picture up to the HUD tag. See the notes above each element.
//
// Drawing (0..1 box, centre 0.5 / 0.5): body ellipse rx 0.215 ry 0.2; two wrapper fans (neck on the body's side,
// zig-zag outer edge with three panels) with 2 pleat lines each; a short tie arc on each neck (only at >= 72 px, it
// would clog the 48 px HUD token); accent dot r 0.05 on the body's upper left. The candy spans x 0.045-0.955 and
// y 0.3-0.7 of the box.
//
// Moves (durations in frames; `dur` on the move overrides; unknown names are ignored; moves add up):
//   twist    14 f   whole candy rotates 0 -> -12 -> +8 -> 0 deg; meanwhile each wrapper end turns half a twist about
//                   the candy's long axis (the fan's height goes 1 -> 0 -> 1, left end first, right end 4 f later),
//                   which is what "twisting a bombom wrapper" looks like in line art.
//   spin     12 f   360 deg, INOUT; the candy recedes to 53 % at mid-turn and lands back (a toss), so its tips never
//                   sweep the headline lines above and below it.
//   sparkle  10 f   a 4-point star stroke draws beside the candy (upper right corner of the box) in `dur` frames
//                   while the candy swells 6 %; the star holds 10 f and then shrinks and fades over 8 f (it is a
//                   twinkle, not a permanent part of the drawing, so the 48 px HUD token stays clean).
//   punch     8 f   scale 1 -> 1.16 -> 1 (the candy is on screen from frame 0 as part of the poster frame; this is
//                   its accent on the spoken "bombom").
//   rock     40 f   +-4 deg sine loop (`dur` = period) that runs from its frame on (closing callback and hold).
//                   args.for = N: it only runs N frames and eases out over the last 8 (hook idle between twist and
//                   spin); args.deg overrides the amplitude.
//
//   blink     9 f   the drawing fades out over 2 f, stays hidden and comes back over the last 3 f of `dur`.
//                   Hook exit: the engine flies the token from its 236 px place beside the headline to the 48 px HUD
//                   token while the headline collapses into the HUD tag on the same corner, so the candy crossed
//                   the fading words (f 105-110). The storyboard blinks it for that flight: it leaves the headline
//                   and lands in the HUD when the words are gone.
import type React from "react";
import {
  C, capHeight, clamp01, defineElement, dim, hexA, INOUT, lerp, OUT, prog, PropSvg, roundRectPath, W,
  type Anchor, type ElementDef, type PropComponent, type PropMove, type Rect,
} from "../elements/api";

const TWIST = 14;
const SPIN = 12;
// The candy recedes while it turns: at 236 px beside the 104 px headline a full-size turn would sweep the lines above
// and below (141 px of clear band, tips 116 px from the centre); with this dip its tips stay inside the band.
const SPIN_DIP = 0.47;
const SPARKLE = 10;
const SPARKLE_HOLD = 10;
const SPARKLE_OUT = 8;
const ROCK = 40;
const PUNCH = 8;
const BLINK = 9;

const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
const r4 = (n: number) => Math.round(n * 10000) / 10000;

interface Pose {
  /** rotation of the whole candy, degrees */
  rot: number;
  /** scale of the whole candy */
  scale: number;
  /** vertical scale of the left / right wrapper fan (1 = open, 0 = edge-on) */
  fanL: number;
  fanR: number;
  /** opacity of the whole drawing (blink) */
  opacity: number;
  /** sparkle: stroke drawn 0..1, scale, opacity, rotation (null = no sparkle on this frame) */
  spark: { drawn: number; scale: number; opacity: number; turn: number } | null;
}

const poseAt = (moves: PropMove[], frame: number): Pose => {
  const p: Pose = { rot: 0, scale: 1, fanL: 1, fanR: 1, opacity: 1, spark: null };
  for (const m of moves) {
    const t = frame - m.at;
    if (t < 0) continue;
    if (m.name === "twist") {
      const dur = m.dur ?? TWIST;
      if (t >= dur) continue;
      const u = t / dur;
      // 0 -> -12 (u 0.3) -> +8 (u 0.65) -> 0 (u 1), each leg eased
      if (u < 0.3) p.rot += -12 * smooth(u / 0.3);
      else if (u < 0.65) p.rot += -12 + 20 * smooth((u - 0.3) / 0.35);
      else p.rot += 8 * (1 - smooth((u - 0.65) / 0.35));
      // half a twist of each wrapper end: |cos| goes 1 -> 0 -> 1 (the fan is symmetric, so the end state = start)
      p.fanL *= Math.abs(Math.cos(Math.PI * smooth(u / 0.62)));
      p.fanR *= Math.abs(Math.cos(Math.PI * smooth((u - 0.3) / 0.62)));
    } else if (m.name === "spin") {
      const dur = m.dur ?? SPIN;
      if (t >= dur) continue;
      const u = t / dur;
      p.rot += 360 * INOUT(u);
      p.scale *= 1 - SPIN_DIP * Math.sin(Math.PI * u);
    } else if (m.name === "sparkle") {
      const dur = m.dur ?? SPARKLE;
      const end = dur + SPARKLE_HOLD + SPARKLE_OUT;
      if (t >= end) continue;
      const k = OUT(clamp01((t + 1) / dur));
      const out = clamp01((t - dur - SPARKLE_HOLD) / SPARKLE_OUT);
      p.spark = { drawn: k, scale: (0.6 + 0.4 * k) * (1 - 0.4 * out), opacity: 1 - out, turn: -30 * (1 - k) };
      if (t < dur) p.scale *= 1 + 0.06 * Math.sin(Math.PI * (t / dur));
    } else if (m.name === "blink") {
      const dur = m.dur ?? BLINK;
      if (t >= dur) continue;
      p.opacity *= Math.max(clamp01(1 - t / 2), clamp01((t - (dur - 3)) / 3));
    } else if (m.name === "punch") {
      const dur = m.dur ?? PUNCH;
      if (t >= dur) continue;
      p.scale *= 1 + 0.16 * Math.sin(Math.PI * smooth(t / dur));
    } else if (m.name === "rock") {
      const period = m.dur ?? ROCK;
      const span = typeof m.args?.for === "number" ? m.args.for : Infinity;
      if (t >= span) continue;
      const deg = typeof m.args?.deg === "number" ? m.args.deg : 4;
      // ease into the loop over the first quarter period so it never snaps; a timed rock eases out over 8 f
      const env = smooth(t / (period / 4)) * (Number.isFinite(span) ? smooth((span - t) / 8) : 1);
      p.rot += deg * Math.sin((2 * Math.PI * t) / period) * env;
    }
  }
  return p;
};

/** One wrapper fan. side = +1 right, -1 left; k = vertical scale (twist). */
const fanPaths = (side: 1 | -1, k: number) => {
  const X = (x: number) => r4(0.5 + side * (x - 0.5));
  const Y = (dy: number) => r4(0.5 + dy * k);
  const outline =
    `M ${X(0.713)} ${Y(0)} Q ${X(0.8)} ${Y(-0.055)} ${X(0.935)} ${Y(-0.2)} `
    + `L ${X(0.885)} ${Y(-0.07)} L ${X(0.955)} ${Y(0)} L ${X(0.885)} ${Y(0.07)} L ${X(0.935)} ${Y(0.2)} `
    + `Q ${X(0.8)} ${Y(0.055)} ${X(0.713)} ${Y(0)} Z`;
  const pleats =
    `M ${X(0.768)} ${Y(-0.012)} L ${X(0.885)} ${Y(-0.07)} M ${X(0.768)} ${Y(0.012)} L ${X(0.885)} ${Y(0.07)}`;
  const tie = `M ${X(0.742)} ${Y(-0.04)} Q ${X(0.764)} ${Y(0)} ${X(0.742)} ${Y(0.04)}`;
  return { outline, pleats, tie };
};

// 4-point star (concave sides) centred on (SX, SY): upper right corner of the box, clear of the right fan
const SX = 0.9;
const SY = 0.13;
const SR = 0.15;
const SW = 0.11;
const SC = 0.16; // how far the control points sit from the centre (0 = needle-thin points)
const STAR =
  `M 0 ${-SR} Q ${r4(SW * SC)} ${r4(-SR * SC)} ${SW} 0 Q ${r4(SW * SC)} ${r4(SR * SC)} 0 ${SR} `
  + `Q ${r4(-SW * SC)} ${r4(SR * SC)} ${-SW} 0 Q ${r4(-SW * SC)} ${r4(-SR * SC)} 0 ${-SR} Z`;

export const Prop: PropComponent = ({ size, frame, moves, color = C.white, accent = C.accent }) => {
  const p = poseAt(moves, frame);
  if (p.opacity <= 0) return null;
  const L = fanPaths(-1, p.fanL);
  const R = fanPaths(1, p.fanR);
  const detail = size >= 72;
  return (
    <PropSvg size={size}>
      {(sw) => (
        <>
          <g transform={`translate(0.5 0.5) rotate(${r4(p.rot)}) scale(${r4(p.scale)}) translate(-0.5 -0.5)`}
            stroke={color} strokeWidth={sw(2) / p.scale} opacity={p.opacity < 1 ? r4(p.opacity) : undefined}>
            <path d={L.outline} />
            <path d={R.outline} />
            <path d={L.pleats} />
            <path d={R.pleats} />
            {detail ? <path d={`${L.tie} ${R.tie}`} /> : null}
            <ellipse cx={0.5} cy={0.5} rx={0.215} ry={0.2} />
            <circle cx={0.425} cy={0.425} r={0.05} fill={accent} stroke="none" />
          </g>
          {p.spark ? (
            <g transform={`translate(${SX} ${SY}) rotate(${r4(p.spark.turn)}) scale(${r4(p.spark.scale)})`} opacity={r4(p.spark.opacity * p.opacity)}>
              <path d={STAR} stroke={color} strokeWidth={sw(2) / p.spark.scale} pathLength={1}
                strokeDasharray={1} strokeDashoffset={r4(1 - p.spark.drawn)} />
            </g>
          ) : null}
        </>
      )}
    </PropSvg>
  );
};

// ---- BandFocus ---------------------------------------------------------------------------------------------------
// SLIDE layer. Everything outside `rect` is dimmed to dim(level) (in over 10 f OUT; the engine fades it out over the
// 6 f after `until`); the rect itself keeps the film's full brightness. `scans`: on each anchor a vertical accent
// line (3 screen px, with a 70 px tail that fades behind it, same look as ScanLine) crosses the rect from one side
// to the other in `dur` frames (INOUT), dir 1 = left to right, -1 = right to left. It always sweeps the WHOLE rect,
// so it points at nothing in particular.
export interface BandFocusProps {
  rect: Rect;
  /** dim outside the rect, 0..1 (default 0.5) */
  level?: number;
  scans?: { at: Anchor; dur?: number; dir?: 1 | -1 }[];
}

const FOCUS_IN = 10;
const SCAN = 22;
const SCAN_TAIL = 70;
const FAR = 4000;

const BandFocus = defineElement<BandFocusProps>({
  defaultUntil: "closing",
  Slide: ({ ctx }) => {
    const { props, frame, at, ease } = ctx;
    const [x0, y0, x1, y1] = props.rect;
    const level = (props.level ?? 0.5) * ease.prog(frame + 1, at, FOCUS_IN, ease.OUT);
    if (level <= 0) return null;
    const outside = `M ${-FAR} ${-FAR} H ${FAR} V ${FAR} H ${-FAR} Z ${roundRectPath(props.rect, 4)}`;
    const id = `rp-c2-band-${ctx.beat.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
    let scan: React.ReactNode = null;
    for (const sc of props.scans ?? []) {
      const f0 = ctx.fr(sc.at);
      const dur = sc.dur ?? SCAN;
      const t = (frame - f0) / dur;
      if (t < 0 || t > 1) continue;
      const dir = sc.dir ?? 1;
      const k = ease.INOUT(t);
      const x = dir > 0 ? x0 + (x1 - x0) * k : x1 - (x1 - x0) * k;
      const tail = Math.min(ctx.px(SCAN_TAIL), dir > 0 ? x - x0 : x1 - x);
      const xt = x - dir * tail;
      const a = Math.min(1, t * dur / 3, (1 - t) * dur / 3);
      scan = (
        <g opacity={a}>
          <defs>
            <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={xt} y1={0} x2={x} y2={0}>
              <stop offset={0} stopColor={C.accent} stopOpacity={0} />
              <stop offset={1} stopColor={C.accent} stopOpacity={0.22} />
            </linearGradient>
          </defs>
          {tail > 0 ? <rect x={Math.min(x, xt)} y={y0} width={tail} height={y1 - y0} fill={`url(#${id})`} /> : null}
          <line x1={x} y1={y0} x2={x} y2={y1} stroke={C.accent} strokeWidth={ctx.px(3)} />
        </g>
      );
    }
    return (
      <>
        <path d={outside} fill={dim(level)} fillRule="evenodd" />
        {scan}
      </>
    );
  },
});

// ---- FilmFeather (look "tela-cheia") -------------------------------------------------------------------------------
// SLIDE layer. In the full-bleed look the film is not cut by a stage box, so its own top and bottom edges are on
// screen: under the HUD scrim (alpha 0.9) the top edge read as a hard grey line, and the bottom edge showed above
// the caption band. This element melts both edges into the page: a band of the PAGE colour (`look.bg.color`, the
// graphite the scrims are painted with) that is opaque on the edge and fades to nothing `top` / `bottom` slide px
// inside the film (smoothstep, so there is no visible start or end of the fade). It is glued to the film (slide
// space), so it holds for every camera key and needs no timing. It paints 3 px outside the film too (antialiased
// edge of the film clip); out there it lies on the scrim, graphite on graphite.
// Used only through `looks["tela-cheia"].addBeats` in c2.json: the default look never mounts it.
export interface FilmFeatherProps {
  /** the film, slide px */
  rect: Rect;
  /** depth of the fade at the top / bottom edge, slide px (default 56; 0 = none) */
  top?: number;
  bottom?: number;
}

const FEATHER = 56;
const FEATHER_OVER = 3;
// alpha of the fade at 0, 1/8 .. 1 of its depth: 1 - smoothstep
const FEATHER_STOPS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((t) => [t, r4(1 - t * t * (3 - 2 * t))] as const);

const FilmFeather = defineElement<FilmFeatherProps>({
  defaultUntil: "end",
  Slide: ({ ctx }) => {
    const [x0, y0, x1, y1] = ctx.props.rect;
    const color = ctx.look.bg.color;
    const id = `rp-c2-feather-${ctx.beat.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
    const band = (key: string, edge: number, depth: number, dir: 1 | -1) => {
      if (depth <= 0) return null;
      const inner = edge + dir * depth;
      const outer = edge - dir * FEATHER_OVER;
      return (
        <g key={key}>
          <defs>
            <linearGradient id={`${id}-${key}`} gradientUnits="userSpaceOnUse" x1={0} y1={edge} x2={0} y2={inner}>
              {FEATHER_STOPS.map(([t, a]) => <stop key={t} offset={t} stopColor={color} stopOpacity={a} />)}
            </linearGradient>
          </defs>
          <rect x={x0 - FEATHER_OVER} y={Math.min(inner, outer)} width={x1 - x0 + 2 * FEATHER_OVER} height={Math.abs(inner - outer)}
            fill={`url(#${id}-${key})`} />
        </g>
      );
    };
    return (
      <>
        {band("t", y0, ctx.props.top ?? FEATHER, 1)}
        {band("b", y1, ctx.props.bottom ?? FEATHER, -1)}
      </>
    );
  },
});

// ---- HookCurtain (look "tela-cheia") -------------------------------------------------------------------------------
// UNDER layer (screen space, inside the stage clip, above the engine's scrims, below marks and chips).
// In the full-bleed look the hook headline sits over the LOWER part of the picture and, on the hook exit, the engine
// collapses it into the HUD tag: for about five frames white type flew across the bare radiograph (1.5 : 1 on the
// bright mediastinum). The curtain is the top scrim stretched down: a sheet of the page colour at the scrims' alpha
// whose soft lower edge drops from the HUD row onto the headline over the frames before H (quadratic ease-in) and
// then rides up with the collapsing block (same clock as HookHeadline: prog(frame, H, 14, OUT), origin = the
// block's top-left corner, scale 1 - 0.7 c), always `pad` px below the block's last baseline. So the type never
// leaves graphite, and the picture is wiped back in from the bottom as the headline leaves.
// Beat: `at` = the frame the curtain starts to drop (H - 6), `until` = H + 7 (the engine fades it over the next 6 f,
// by then the edge is back at the HUD row and the block's own opacity is 0).
export interface HookCurtainProps {
  /** distance of the solid edge below the headline block, px (default 40) */
  pad?: number;
  /** depth of the soft edge below the solid part, px (default 140) */
  soft?: number;
}

const HEAD_PITCH = 1.04; // line pitch of the engine's headline, x size (components/Headline.tsx)
const HEAD_TAG = { capTop: 248, shrink: 0.7, dur: 14 }; // where and how HookHeadline collapses (components/Hud.tsx)
const CURTAIN_STOPS = [0, 0.25, 0.5, 0.75, 1].map((t) => [t, 1 - t * t * (3 - 2 * t)] as const);

const HookCurtain = defineElement<HookCurtainProps>({
  Under: ({ ctx }) => {
    const { frame, at, look, r } = ctx;
    const bleed = look.layout.bleed;
    if (!bleed) return null;
    const hook = r.sb.hook;
    const place = look.layout.headline;
    const tall = (hook.lines.length - 1) * HEAD_PITCH * hook.size + capHeight(hook.size);
    const capTop = place.bottom === null ? place.capTop : place.bottom - tall;
    const pad = ctx.props.pad ?? 40;
    const soft = ctx.props.soft ?? 140;
    let edge: number;
    if (frame < r.H) {
      const t = clamp01((frame - at) / Math.max(1, r.H - at));
      // starts with its soft edge inside the top scrim's plateau, so mounting it changes nothing visible
      edge = lerp(bleed.hookTop - soft, capTop + tall + pad, t * t);
    } else {
      const c = prog(frame, r.H, HEAD_TAG.dur, OUT);
      edge = lerp(capTop, HEAD_TAG.capTop, c) + tall * (1 - HEAD_TAG.shrink * c) + pad;
    }
    const stops = CURTAIN_STOPS.map(([t, a]) => `${hexA(look.bg.color, r4(bleed.alpha * a))} ${Math.round(edge + soft * t)}px`);
    return (
      <div style={{
        position: "absolute", left: 0, top: 0, width: W, height: Math.round(edge + soft),
        background: `linear-gradient(180deg, ${hexA(look.bg.color, bleed.alpha)} 0px, ${stops.join(", ")})`,
      }} />
    );
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const elements: Record<string, ElementDef<any>> = { BandFocus, FilmFeather, HookCurtain };
