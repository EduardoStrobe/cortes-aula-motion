// CursorHalo — SYSTEM 8.15. OWNER: slide-group element author.
// Ring d 72 px (2.5 px accent over a dim under-stroke) + 6 px accent dot (screen px, constant under any camera
// scale), centred on the pointer + (5,7) slide px (the arrow's body).
// Position = ctx.cursor.follow(): the current sample lightly blended with its neighbours. The SYSTEM text asked for
// a 7-frame moving average, but the recorded arrow moves in 15 fps steps of 60-100 slide px and the mean trailed it
// by 30-90 screen px on every sweep (c2 f 800, c3 f 160, c4 f 960, c6 f 475): the ring must CONTAIN the arrow, so
// it now rides it. The ring was 64 px / 1.5 px: too thin to read on a phone.
// It is drawn in the SLIDE layer, so it follows the camera, sits above covers (c1 12b) and below chips.
// - Fades in over 6 f from `from` (no fade when `from` <= 0: c3 has it on the poster frame); the engine fades it
//   over the 6 f after `to` (the beat's `until`; a halo that runs to T fades at C 0-6 as c4/c6 ask).
// - Hidden while the pointer has no sample for more than 10 f: it fades out over the first 6 f of such a run
//   (parked on the last sample) and back in over its last 6 f (already on the next sample). Shorter gaps are
//   bridged by holding the nearest sample.
// - Time is ctx.videoFrame: with freezeStageAt (c3) and in every closing the halo freezes with the picture.
// - The beat's `at` may be earlier than `from` (c1 beat 6: word f 381, halo from f 384); nothing shows before
//   `from`.
import { defineElement } from "../api";
import { cutByJoin, pointerFade } from "./shared";

export interface CursorHaloProps {
  /** absolute frames */
  from: number;
  to: number;
}

export const CursorHalo = defineElement<CursorHaloProps>({
  defaultUntil: (b) => b.props.to,
  Slide: ({ ctx }) => {
    const { props, frame, ease, tokens: { C, dim } } = ctx;
    if (frame < props.from || cutByJoin(ctx)) return null;
    const vf = ctx.videoFrame;
    const p = ctx.cursor.follow(vf, 10);
    if (!p) return null;
    const opacity = (props.from <= 0 ? 1 : ease.clamp01((frame + 1 - props.from) / 6)) * pointerFade(ctx.cursor, vf);
    if (opacity <= 0) return null;
    const x = p[0] + 5;
    const y = p[1] + 7;
    return (
      <g opacity={opacity}>
        <circle cx={x} cy={y} r={ctx.px(36)} fill="none" stroke={dim(0.5)} strokeWidth={ctx.px(4.5)} />
        <circle cx={x} cy={y} r={ctx.px(36)} fill="none" stroke={C.accent} strokeWidth={ctx.px(2.5)} />
        <circle cx={x} cy={y} r={ctx.px(3)} fill={C.accent} />
      </g>
    );
  },
});
