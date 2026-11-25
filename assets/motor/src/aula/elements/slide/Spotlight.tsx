// Spotlight — SYSTEM 8.17. OWNER: slide-group element author.
// dim(0.65) over the whole stage except the `keep` rects (SLIDE space, so the lit windows follow the camera).
// SCREEN space, `Over` layer: it also dims chips that sit outside the lit rects (z-order of SYSTEM 12).
// In: dim 0 -> 0.65 over 8 f, linear. Out: the engine's 6-frame fade after `until`.
// `swap`: on each swap anchor the lit rects cross over to the new set in 8 f (linear). It is ONE dim layer with a
// luminance mask in which every keep rect is a hole weighted by its set's presence, so areas that are dim in both
// sets stay at exactly 0.65 during the swap (two cross-fading dim layers would dip to 0.54 and flicker).
// Holes have a 4 slide-px radius, the same as the film clip.
import { defineElement, type Anchor, type Rect } from "../api";

export interface SpotlightProps {
  keep: Rect[];
  swap?: { at: Anchor; keep: Rect[] }[];
}

const IN = 8;

export const Spotlight = defineElement<SpotlightProps>({
  defaultUntil: "closing",
  Over: ({ ctx }) => {
    const { props, frame, at, ease, stage, tokens: { C, dim, W, H } } = ctx;
    const level = 0.65 * ease.prog(frame + 1, at, IN);
    if (level <= 0) return null;
    const sets = [{ f: at, keep: props.keep }, ...(props.swap ?? []).map((s) => ({ f: ctx.fr(s.at), keep: s.keep }))]
      .sort((a, b) => a.f - b.f);
    const inAt = sets.map((s, i) => (i === 0 ? 1 : ease.prog(frame + 1, s.f, IN)));
    const id = `rp-spot-${ctx.beat.id.replace(/[^A-Za-z0-9_-]/g, "_")}${ctx.pane === null ? "" : `-p${ctx.pane}`}`;
    const r = 4 * ctx.cam.s;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            {/* mask luminance only (white = dim, black = lit); neither value is ever painted */}
            <rect x={stage.left} y={stage.top} width={stage.w} height={stage.h} fill={C.white} />
            {sets.map((s, i) => {
              const weight = inAt[i] * (i + 1 < sets.length ? 1 - inAt[i + 1] : 1);
              if (weight <= 0) return null;
              return s.keep.map((k, j) => {
                const b = ctx.rectToScreen(k);
                return <rect key={`${i}-${j}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={r} fill={C.filmBlack} opacity={weight} />;
              });
            })}
          </mask>
        </defs>
        <rect x={stage.left} y={stage.top} width={stage.w} height={stage.h} fill={dim(level)} mask={`url(#${id})`} />
      </svg>
    );
  },
});
