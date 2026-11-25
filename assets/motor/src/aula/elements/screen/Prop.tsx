// Prop (film placement) — SYSTEM 8.22. OWNER: screen-group element author.
// Hosts the cut's Prop component (ctx.Prop, placement "film") in SCREEN space over the stage: a square box of `size`
// px centred on `screen` (canvas px) or glued to the slide point `slide` (it then follows the camera; its SIZE never
// scales with the camera). The Prop only draws inside the box; this element positions it and plays:
//   in      scale 0 -> 1, 8 f POP, on the beat's frame; the Prop gets `appear` = that frame
//   moves   resolved (ctx.fr) and handed to the Prop untouched: { name, at, dur?, args? }
//   fly     c1: from `fly.at` the box travels (INOUT, `dur` 14 f) from where it is to the slide point `fly.to`
//           while its side goes `size` -> `fly.size`; the target is re-projected every frame, so it lands on the
//           object even if the camera moves. On landing it cross-fades out over `fade` frames (4) into the Ring
//           beat that starts there. Give the beat `until` = landing + fade (c1: f 200).
//   out     without fly: opacity 1 -> 0 over the 6 frames after `until`
//   sound   "pop" on landing (fly) or, without fly, on the beat's frame ("prop landing"); `sound: false` = silent
//
// Beyond the SYSTEM text (needed by c3's chevrons, which travel along SLIDE-space lines while a Prop may only
// draw inside its box):
//   slide-space args   every move argument that is a list of slide points (e.g. args.path / args.segment =
//                      [[x,y],[x,y],...]) is passed on untouched AND, re-projected at the current camera, as
//                      `<name>Box` in BOX units (0..1 = the box, origin top-left; values may leave 0..1). A single
//                      point (args.to = [x,y]) becomes `toBox`. The Prop can draw along `args.pathBox` with
//                      overflow visible and stays glued to the film.
//   default position   with neither `screen` nor `slide`, the box is centred on the bounding box of the first
//                      slide-space path found in `moves` (follows the camera).
//   hero               HERO ENTRANCE (shared.heroEntrance): a prop placed by `screen` / `slide` whose moves carry no
//                      slide-space argument pops big in the middle of the dimmed stage on its word, holds 20 f and
//                      flies (14 f) to its own position. It is a CSS scale, so the Prop still draws at `size` and
//                      its strokes grow with it. `hero: false` opts out. Props glued to slide-space paths (c3's
//                      chevrons) never get it. With a `fly` that starts before the entrance is over (c1: the
//                      coin flies to the object 30 f after it appears) the prop stays big in the centre until
//                      `fly.at` and flies from THERE to the target, shrinking on the way.
import {
  clamp01, defineElement, INOUT, lerp, moveSpecs, pop, prog, type Anchor, type ElCtx, type MoveSpec, type PropMove, type Pt,
} from "../api";
import { HERO, heroEntrance, HeroDim } from "./shared";

export interface PropElProps {
  /** centre of the prop box in SCREEN px ... */
  screen?: [number, number];
  /** ... or a SLIDE point its centre is glued to (follows the camera). Exactly one of screen/slide. */
  slide?: Pt;
  /** side of the box in screen px (>= 130) */
  size: number;
  /** named moves (flip, push, ...); args are passed to the Prop untouched (e.g. { turns: 540 }, { path: [[x,y],...] }) */
  moves?: MoveSpec[];
  /** c1 "fly": travel from the current position to slide point `to` over `dur` frames (default 14, INOUT) while
   *  the box resizes to `size`; cross-fades out over `fade` frames (default 4) at the end (into the Ring beat that
   *  starts there). Plays "pop" on landing. */
  fly?: { at: Anchor; to: Pt; dur?: number; size?: number; fade?: number };
  /** [screen group] false = no "pop" cue */
  sound?: boolean;
  /** [engine] false = no hero entrance (default true, see shared.heroEntrance) */
  hero?: boolean;
}

const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number";
const isPath = (v: unknown): v is Pt[] => Array.isArray(v) && v.length >= 2 && v.every(isPt);

const firstPath = (specs: MoveSpec[] | undefined): Pt[] | null => {
  for (const m of specs ?? []) for (const v of Object.values(m.args ?? {})) if (isPath(v)) return v;
  return null;
};

const basePos = (ctx: ElCtx<PropElProps>): Pt => {
  const { props } = ctx;
  if (props.screen) return [props.screen[0], props.screen[1]];
  if (props.slide) return ctx.toScreen(props.slide);
  const path = firstPath(props.moves);
  if (!path) throw new Error(`[aula] Prop "${ctx.beat.id}": give "screen" or "slide" (or a move with a slide-space path)`);
  const xs = path.map((p) => p[0]);
  const ys = path.map((p) => p[1]);
  return ctx.toScreen([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
};

export const Prop = defineElement<PropElProps>({
  defaultUntil: "closing",
  ownExit: true,
  cues: (beat, r) => {
    const p = beat.props;
    if (p.sound === false) return [];
    if (p.fly) return [{ f: r.fr(p.fly.at, `beat "${beat.id}" fly`) + (p.fly.dur ?? 14), cue: "pop" }];
    return [{ f: beat.at, cue: "pop" }];
  },

  Screen: ({ ctx }) => {
    const { props, frame, at, age } = ctx;
    if (age < 0) return null;
    let [cx, cy] = basePos(ctx);
    let size = props.size;
    let opacity = 1 - ctx.exit;
    const slideArgs = (props.moves ?? []).some((m) => Object.values(m.args ?? {}).some((v) => isPath(v) || isPt(v)));
    const heroOk = props.hero !== false && !slideArgs && !!(props.screen || props.slide);
    // a fly that starts before the hero entrance is over: the prop waits in the centre and leaves with the fly
    const direct = heroOk && !!props.fly && ctx.fr(props.fly.at) < at + HERO.hold + HERO.fly
      && heroEntrance({ ...ctx, frame: at }, { left: 0, top: 0, w: size, h: size }).k < 1;
    let hero = { dx: 0, dy: 0, scale: 1, dim: 0, k: 1 };
    if (direct) {
      const st = ctx.stage;
      cx = st.cx;
      cy = st.cy;
    }
    if (props.fly) {
      const f0 = ctx.fr(props.fly.at);
      const dur = props.fly.dur ?? 14;
      const k = prog(frame, f0, dur, INOUT);
      const [tx, ty] = ctx.toScreen(props.fly.to);
      cx = lerp(cx, tx, k);
      cy = lerp(cy, ty, k);
      size = lerp(props.size, props.fly.size ?? props.size, k);
      opacity = Math.min(opacity, 1 - clamp01((frame - (f0 + dur)) / Math.max(1, props.fly.fade ?? 4)));
      if (direct) {
        const s0 = Math.max(1, Math.min(HERO.maxSide / props.size, (ctx.stage.h - 60) / props.size));
        hero = { dx: 0, dy: 0, scale: lerp(s0, 1, k), dim: HERO.dim * (1 - k) * clamp01((frame - at + 1) / 4), k };
      }
    }
    if (opacity <= 0) return null;
    const left = cx - size / 2;
    const top = cy - size / 2;
    if (!direct) hero = heroEntrance(ctx, { left, top, w: size, h: size }, heroOk);

    // slide-space arguments -> box units at the current camera
    const toBox = (p: Pt): Pt => {
      const [sx, sy] = ctx.toScreen(p);
      return [(sx - left) / size, (sy - top) / size];
    };
    const moves: PropMove[] = moveSpecs(props.moves, ctx.fr).map((m) => {
      if (!m.args) return m;
      const extra: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(m.args)) {
        if (isPath(v)) extra[`${key}Box`] = v.map(toBox);
        else if (isPt(v)) extra[`${key}Box`] = toBox(v);
      }
      return Object.keys(extra).length ? { ...m, args: { ...m.args, ...extra } } : m;
    });

    const P = ctx.Prop;
    return (
      <>
        <HeroDim ctx={ctx} level={hero.dim * opacity} />
        <div style={{
          position: "absolute", left, top, width: size, height: size, opacity,
          transform: `translate(${hero.dx}px, ${hero.dy}px) scale(${pop(age + 1) * hero.scale})`, transformOrigin: "50% 50%",
        }}>
          <P size={size} placement="film" frame={frame} moves={moves} appear={at} />
        </div>
      </>
    );
  },
});
