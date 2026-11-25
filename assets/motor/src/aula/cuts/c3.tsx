// c3 — cut module. OWNER: the c3 cut author.
//
// Prop = TracheaPush (SYSTEM 8.22). Line art only: 2 px white strokes, ONE accent detail, transparent fill.
//
//   token  (kicker row 84 px <-> HUD 48 px)  the airway: a vertical tube (two walls 0.28 apart) with C-ring arcs, the
//          top ring in accent, ending in the carina (an inverted Y) so that it reads as a trachea and not as a ladder.
//          Five rings at 84 px; below about 66 px the five cross-fade to three (five 2 px rings on a 48 px icon
//          close up into a grey block).
//   card   the same tube, moved right, with the three chevrons resting against its wall.
//   film   ONLY the three ">" chevrons, 44 px tall, 3 px accent over a 5 px dim(0.5) under-stroke. They are drawn
//          along `args.pathBox` (the slide-space `args.path` of the move, re-projected into box units on every
//          frame by the Prop element), so they stay glued to the film while the camera moves.
//
// Moves (unknown names are ignored):
//   pulse  scale 1 -> 1.1 -> 1, 10 f (token: the hook accent word).
//   push   the chevron TRAIN shoves along the path, `args.passes` times (default 3) in `dur` frames (default 10 f
//          per pass). One pass: the leader thrusts from the start of the path to its end (cubic out), the two
//          followers start 12 % of the pass later each, so the train stretches and closes up again against the
//          end of the path. Between passes the train fades (last 14 % of the pass) and re-appears at the start.
//          After the LAST pass the train stays at the end of the path (leader tip on the last point, the others
//          30 px behind each) and idles: every 36 f a 5 px nudge runs through it from the rear to the front.
//          `args.scale` (default 1) = chevron size factor of that move (c3: 1.25, and 1.75 on "meio sério").
//          `args.stay: false` = film: the train does NOT rest at the end of the path, it fades on arrival of every
//          pass (c3 beat 10d: the pointer path is diagonal and curved, and three chevrons parked at its end would
//          read as an arrow pointing somewhere he never pointed).
//          With no path (token, card, or a film beat without args) the train runs on a built-in horizontal path
//          that ends at the tube's wall.
//   lean   token/card: one train pass towards the tube (it fades on arrival), then the tube leans 6 deg away from
//          it and comes back (18 f). The chevrons always come from the same side as the film chevrons of beat 8.
//          In the token they emerge at the box's left edge (a chevron is invisible until it is inside the box), so
//          nothing is ever drawn left of the layout margin (x 60).
//   idle   token: from this frame on the tube sways +-2 deg (60 f sine). Used for the closing hold only.
//
//   quote  token only, LOOKS only (c3.json -> looks["azul-claro"].tokenMoves; the default storyboard has no such
//          move, so `rp-c3` never draws it). The hook of that look is a quote post: instead of the inline quotes
//          of the headline (`hook.quoted: false` there) ONE large opening quote mark heads the block. It is the
//          real Manrope 600 glyph in the token's `color` (= the page ink of the look), drawn from the move's
//          frame for `dur` frames (= hook.exit; it fades over the last 3, with the kicker row) at the SCREEN
//          position `args.x` (left edge of the ink) / `args.capTop`, type size `args.size`. It is the only thing
//          this Prop ever draws outside its box (PropSvg and the token host do not clip): the mark belongs to
//          the page, and the token is the cut's only component the engine mounts on the page. The position is
//          converted with the token's hook place (Z.token.hook), so the move must end before the token travels.
//          It settles x 0.94 -> 1 with the headline block and swells with the token's `pulse`.
//
// Direction honesty (c3.md, "No laterality graphics"): nothing here is labelled; the film chevrons only ever run
// along the paths the storyboard gives them, which are the doctor's own pointer paths.
import React from "react";
import {
  activeMove, bump, C, capOffset, catmullRomPath, clamp01, defineElement, dim, EXIT_FRAMES, frames, lerp, OUT, prog,
  PropSvg, Txt, Z,
  type Anchor, type ElementDef, type PropComponent, type PropMove, type Pt,
} from "../elements/api";

// ---- the chevron train ---------------------------------------------------------------------------------------------
const CHEVRONS = 3;
/** fraction of a pass by which each follower starts later than the chevron in front of it */
const STAGGER = 0.12;
/** fraction of a pass one chevron needs for its thrust */
const TRAVEL = 0.62;
const FADE_FROM = 0.86;
const thrust = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

interface ChevState { e: number; opacity: number; nudge: number }
interface TrainState { chev: ChevState[]; scale: number; t: number; dur: number }

const REST: ChevState = { e: 1, opacity: 1, nudge: 0 };

/** State of the train for the latest started move among `names`. `stay` = the train remains (and idles) after the
 *  last pass; otherwise it fades on arrival. Returns null when no such move has started. */
const trainAt = (moves: PropMove[], frame: number, names: string[], stay: boolean, defPasses = 3): TrainState | null => {
  const hit = activeMove(moves, frame, names);
  if (!hit) return null;
  const { move, t } = hit;
  const passes = Math.max(1, Math.round(Number(move.args?.passes ?? defPasses)));
  const dur = Math.max(1, move.dur ?? passes * 10);
  const scale = Number(move.args?.scale ?? 1);
  const p = dur / passes;
  if (t >= dur) {
    if (!stay) return { chev: [], scale, t, dur };
    const rest = t - dur;
    const chev: ChevState[] = [];
    for (let i = 0; i < CHEVRONS; i++) {
      // the nudge starts at the rear chevron and reaches the leader 6 f later
      const ph = (((rest - 8 - 3 * (CHEVRONS - 1 - i)) % 36) + 36) % 36;
      const on = rest >= 8 && ph < 12;
      chev.push({ e: 1, opacity: 1, nudge: on ? 0.5 - 0.5 * Math.cos((2 * Math.PI * ph) / 12) : 0 });
    }
    return { chev, scale, t, dur };
  }
  const k = Math.min(passes - 1, Math.floor(t / p));
  const x = (t - k * p) / p;
  const last = k === passes - 1;
  const chev: ChevState[] = [];
  for (let i = 0; i < CHEVRONS; i++) {
    const x0 = STAGGER * i;
    const fadeIn = clamp01((x - x0 + 0.07) / 0.14);
    const fadeOut = last && stay ? 1 : 1 - clamp01((x - FADE_FROM) / (1 - FADE_FROM));
    chev.push({ e: thrust((x - x0) / TRAVEL), opacity: fadeIn * fadeOut, nudge: 0 });
  }
  return { chev, scale, t, dur };
};

// ---- a path the train runs on (box units) --------------------------------------------------------------------------
const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number";
const isPath = (v: unknown): v is Pt[] => Array.isArray(v) && v.length >= 2 && v.every(isPt);

/** Uniform Catmull-Rom through the points, sampled densely (a 2-point path stays a straight segment). */
const smooth = (pts: Pt[]): Pt[] => {
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]];
  const k = 0.5 / 3;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    for (let j = 1; j <= 16; j++) {
      const t = j / 16;
      const u = 1 - t;
      out.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  return out;
};

interface Rail { length: number; at(a: number): Pt }
/** Arc-length parameterised path. `a` may be negative (the followers wait BEHIND the start: the rail is extended
 *  straight backwards) or beyond the length (extended straight ahead). */
const makeRail = (raw: Pt[]): Rail => {
  const pts = smooth(raw);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const length = cum[cum.length - 1];
  const dirOf = (a: Pt, b: Pt): Pt => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const d0 = dirOf(pts[0], pts[1]);
  const d1 = dirOf(pts[pts.length - 2], pts[pts.length - 1]);
  return {
    length,
    at: (a) => {
      if (a <= 0) return [pts[0][0] + d0[0] * a, pts[0][1] + d0[1] * a];
      if (a >= length) {
        const e = pts[pts.length - 1];
        return [e[0] + d1[0] * (a - length), e[1] + d1[1] * (a - length)];
      }
      let i = 1;
      while (i < cum.length - 1 && cum[i] < a) i++;
      const seg = cum[i] - cum[i - 1] || 1;
      const k = (a - cum[i - 1]) / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    },
  };
};

/** The three chevrons of a train on a rail. All lengths are in box units (1 = the prop box). */
const Train: React.FC<{
  state: TrainState; path: Pt[]; h: number; gap: number; nudge: number;
  stroke: number; under?: number; color: string;
  /** box x (0..1 units) left of which nothing is drawn: a chevron fades in while its back end crosses it */
  clipLeft?: number;
}> = ({ state, path, h, gap, nudge, stroke, under, color, clipLeft }) => {
  const rail = makeRail(path);
  const hh = h * state.scale;
  const gg = gap * state.scale;
  const w = hh * 0.46;
  const d = `M ${-w} ${-hh / 2} L 0 0 L ${-w} ${hh / 2}`;
  return (
    <>
      {state.chev.map((c, i) => {
        if (c.opacity <= 0.01) return null;
        // the leader travels the whole rail; follower i ends i gaps behind it and starts i gaps behind the start
        const a = c.e * rail.length - i * gg + c.nudge * nudge;
        const [x, y] = rail.at(a);
        const edge = clipLeft === undefined ? 1 : clamp01((x - w - clipLeft) / (w * 0.6));
        if (c.opacity * edge <= 0.01) return null;
        const p0 = rail.at(a - hh * 0.4);
        const p1 = rail.at(a + hh * 0.4);
        const deg = (Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${deg})`} opacity={c.opacity * edge}>
            {under ? <path d={d} stroke={dim(0.5)} strokeWidth={under} /> : null}
            <path d={d} stroke={color} strokeWidth={stroke} />
          </g>
        );
      })}
    </>
  );
};

// ---- the airway (token / card) -------------------------------------------------------------------------------------
const RINGS_5 = [0.13, 0.23, 0.33, 0.43, 0.53];
const RINGS_3 = [0.14, 0.31, 0.48];
const ringPath = (y: number) => `M 0.36 ${y} Q 0.5 ${y + 0.075} 0.64 ${y}`;

const Tube: React.FC<{ size: number; sw: (px: number) => number; color: string; accent: string }> = ({ size, sw, color, accent }) => {
  // five rings at 84 px, three at 48 px (cross-fade while the token resizes)
  const k5 = clamp01((size - 56) / 20);
  const rings = (ys: number[], opacity: number) => (opacity <= 0.01 ? null : (
    <g opacity={opacity}>
      {ys.map((y, i) => <path key={y} d={ringPath(y)} stroke={i === 0 ? accent : color} />)}
    </g>
  ));
  return (
    <g stroke={color} strokeWidth={sw(2)}>
      {/* walls running into the two main bronchi */}
      <path d="M 0.36 0.04 V 0.6 Q 0.36 0.72 0.18 0.9" />
      <path d="M 0.64 0.04 V 0.6 Q 0.64 0.72 0.82 0.9" />
      {/* carina */}
      <path d="M 0.31 0.96 L 0.5 0.76 L 0.69 0.96" />
      {rings(RINGS_5, k5)}
      {rings(RINGS_3, 1 - k5)}
    </g>
  );
};

/** degrees the tube leans: 6 deg away from the chevrons after their impact, plus the closing idle sway */
const leanDeg = (moves: PropMove[], frame: number, names: string[]): number => {
  let deg = 0;
  const m = activeMove(moves, frame, names);
  if (m) {
    const passes = Math.max(1, Math.round(Number(m.move.args?.passes ?? 1)));
    const p = (m.move.dur ?? passes * 10) / passes;
    // one lean per pass, starting when the leader lands (about 45 % into the pass)
    for (let k = 0; k < passes; k++) deg = Math.max(deg, 6 * bump(frame, m.move.at + k * p + 0.45 * p, 18));
  }
  const idle = activeMove(moves, frame, ["idle"]);
  if (idle) deg += 2 * Math.sin((2 * Math.PI * idle.t) / 60) * clamp01(idle.t / 12);
  return deg;
};

// built-in rails (box units)
const TOKEN_PATH: Pt[] = [[-0.1, 0.34], [0.33, 0.34]];
const CARD_PATH: Pt[] = [[0.0, 0.4], [0.4, 0.4]];
const FILM_PATH: Pt[] = [[0.2, 0.5], [0.8, 0.5]];

// ---- the large opening quote mark of a quote-post hook (move "quote", looks only) --------------------------------
/** Manrope 600 metrics of the glyph, in em: left side bearing, and how far its ink ends below the cap-top. */
const QUOTE_GLYPH = { bearing: 0.08, inkBottom: 0.24 };
const QuoteMark: React.FC<{ moves: PropMove[]; frame: number; color: string }> = ({ moves, frame, color }) => {
  const q = activeMove(moves, frame, ["quote"]);
  if (!q) return null;
  const dur = q.move.dur ?? 100;
  if (q.t >= dur) return null;
  const args = q.move.args ?? {};
  const size = Number(args.size ?? 330);
  const x = Number(args.x ?? Z.left);
  const capTop = Number(args.capTop ?? 366);
  const settle = lerp(0.94, 1, prog(frame, q.move.at, 8, OUT));
  const pulse = activeMove(moves, frame, ["pulse"]);
  const swell = pulse ? 1 + 0.08 * bump(frame, pulse.move.at, pulse.move.dur ?? 10) : 1;
  const left = x - Z.token.hook.x - QUOTE_GLYPH.bearing * size;
  return (
    <Txt x={left} capTop={capTop - Z.token.hook.y} size={size} color={color} opacity={1 - prog(q.t, dur - 3, 3)}
      style={{
        // grows from the ink's bottom-left corner, the corner nearest to the first headline word
        transform: `scale(${settle * swell})`,
        transformOrigin: `${QUOTE_GLYPH.bearing * size}px ${capOffset(size) + QUOTE_GLYPH.inkBottom * size}px`,
      }}>{"“"}</Txt>
  );
};

export const Prop: PropComponent = ({ size, placement, frame, moves, color = C.white, accent = C.accent }) => {
  const pulse = activeMove(moves, frame, ["pulse"]);
  const scale = pulse ? 1 + 0.1 * bump(frame, pulse.move.at, pulse.move.dur ?? 10) : 1;

  if (placement === "film") {
    // chevrons only. Before the first push they simply rest at the end of the path.
    const first = moves.find((m) => m.name === "push");
    const act = activeMove(moves, frame, ["push"]);
    const stay = (act?.move ?? first)?.args?.stay !== false;
    const state: TrainState = trainAt(moves, frame, ["push"], stay)
      ?? { chev: stay ? [REST, REST, REST] : [], scale: Number(first?.args?.scale ?? 1), t: 0, dur: 0 };
    const boxPath = (act ?? (first ? { move: first } : null))?.move.args?.pathBox;
    const path = isPath(boxPath) ? boxPath : FILM_PATH;
    return (
      <PropSvg size={size} style={{ transform: `scale(${scale})` }}>
        {(sw) => (
          <Train state={state} path={path} h={sw(44)} gap={sw(30)} nudge={sw(5)}
            stroke={sw(3)} under={sw(5)} color={accent} />
        )}
      </PropSvg>
    );
  }

  const card = placement === "card";
  // token: the chevrons only exist during a lean / push and fade on arrival; card: they rest against the tube
  const state = trainAt(moves, frame, ["lean", "push"], card, 1)
    ?? (card ? { chev: [REST, REST, REST], scale: 1, t: 0, dur: 0 } : null);
  const deg = leanDeg(moves, frame, ["lean", "push"]);
  return (
    <>
      {card ? null : <QuoteMark moves={moves} frame={frame} color={color} />}
      <PropSvg size={size} style={{ transform: `scale(${scale})` }}>
        {(sw) => (
          <>
            <g transform={card ? "translate(0.2 0.06) scale(0.88)" : undefined}>
              <g transform={`rotate(${deg} 0.5 0.9)`}>
                <Tube size={size} sw={card ? (px) => sw(px) / 0.88 : sw} color={color} accent={accent} />
              </g>
            </g>
            {state ? (
              <Train state={state} path={card ? CARD_PATH : TOKEN_PATH}
                h={card ? 0.2 : 0.22} gap={card ? 0.11 : 0.105} nudge={card ? 0.03 : 0}
                stroke={sw(2)} color={accent} clipLeft={card ? undefined : 0} />
            ) : null}
          </>
        )}
      </PropSvg>
    </>
  );
};

// ---- Ghost (beat 2): the displaced copy of the trachea trace -------------------------------------------------------
// Review: the engine's ghost Trace (3 px text2, dash 8 6) could not be seen on a phone. Same idea, readable:
// a 5 px WHITE dashed copy (dash 14 9) over a dim(0.5) under-stroke with the trace's white head dot. It appears on
// the blue trace, slides `shift.dx` slide px over `shift.dur` frames (OUT) and drags two fading echoes behind it
// while it travels. `blinks`: opacity 1 -> 0.2 -> 1 -> 0.2 (12 f), then it stays at 0.3 until the beat exits.
// Nothing is labelled and no direction is drawn: the copy only goes where his pointer goes (c3.md).
interface GhostProps { points: Pt[]; shift: { at: Anchor; dx: number; dur?: number }; blinks?: Anchor[] }
const ghostBlink = (d: number): number => {
  if (d <= 0) return 1;
  if (d >= 12) return 0.3;
  const leg = Math.floor(d / 4);
  const t = (d - leg * 4) / 4;
  return leg === 1 ? 0.2 + 0.8 * t : 1 - 0.8 * t;
};
const Ghost = defineElement<GhostProps>({
  defaultUntil: "closing",
  Slide: ({ ctx }) => {
    const { props, frame, at, ease } = ctx;
    // a mark whose exit would run over a hard join is cut ON the join (same rule as the engine's slide marks)
    if (ctx.joins.some((j) => j >= ctx.until && j <= ctx.until + EXIT_FRAMES && frame >= j)) return null;
    if (props.points.length < 2) return null;
    const d = catmullRomPath(props.points);
    const f0 = ctx.fr(props.shift.at);
    const dur = props.shift.dur ?? 16;
    const k = (f: number) => ease.prog(f + 1, f0, dur, ease.OUT);
    const now = k(frame);
    let opacity = clamp01((frame + 1 - at) / 4);
    for (const b of frames(ctx, props.blinks)) opacity *= ghostBlink(frame - b);
    const end = props.points[props.points.length - 1];
    const dash = `${ctx.px(14)} ${ctx.px(9)}`;
    const copy = (kk: number, o: number, key: string, head: boolean) => (
      <g key={key} transform={`translate(${props.shift.dx * kk} 0)`} opacity={o}>
        <path d={d} fill="none" stroke={dim(0.5)} strokeWidth={ctx.px(8)} strokeDasharray={dash} />
        <path d={d} fill="none" stroke={C.white} strokeWidth={ctx.px(5)} strokeDasharray={dash} />
        {head ? (
          <>
            <circle cx={end[0]} cy={end[1]} r={ctx.px(7.5)} fill={dim(0.5)} />
            <circle cx={end[0]} cy={end[1]} r={ctx.px(6)} fill={C.white} />
          </>
        ) : null}
      </g>
    );
    const travelling = now > 0 && now < 1;
    return (
      <g opacity={opacity}>
        {travelling ? copy(k(frame - 6), 0.16, "e2", false) : null}
        {travelling ? copy(k(frame - 3), 0.32, "e1", false) : null}
        {copy(now, 1, "g", true)}
      </g>
    );
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const elements: Record<string, ElementDef<any>> = { Ghost };
