// ScanLine — SYSTEM 8.16. OWNER: slide-group element author.
// 2 px accent horizontal line across the stage with a 60 px tail above it (accent 12 % -> 0), sweeping from the
// stage's top edge to its bottom edge in `dur` frames, linear. SCREEN space, `Over` layer (above chips). It reads
// the CURRENT stage rect every frame, so it also works in the slot and in a hook pane.
// Exit: the element owns it (ownExit). During the 6 frames after the sweep the line simply keeps travelling at
// the same speed and leaves through the stage's bottom edge (the stage clips it), so the tail is never left
// hanging or faded in place.
// `opacity` multiplies line and tail (default 1; cadence fillers use 0.4, SYSTEM 6).
import { defineElement } from "../api";
import { accentA } from "./shared";

export interface ScanLineProps {
  /** absolute start frame (default: the beat `at`) */
  from?: number;
  /** frames of the sweep (18-60) */
  dur: number;
  /** default 1; fillers use 0.4 */
  opacity?: number;
}

const TAIL = 60;

export const ScanLine = defineElement<ScanLineProps>({
  defaultUntil: (b) => (b.props.from ?? b.at) + b.props.dur,
  ownExit: true,
  Over: ({ ctx }) => {
    const { props, frame, stage, tokens: { C } } = ctx;
    const from = props.from ?? ctx.at;
    if (frame < from || props.dur <= 0) return null;
    const y = stage.top + (stage.h * (frame - from)) / props.dur;
    if (y - TAIL > stage.bottom) return null;
    return (
      <div style={{ position: "absolute", left: stage.left, top: y - TAIL, width: stage.w, height: TAIL + 1, opacity: props.opacity ?? 1 }}>
        <div style={{
          position: "absolute", left: 0, top: 0, width: "100%", height: TAIL - 1,
          background: `linear-gradient(to bottom, ${accentA(0)} 0%, ${accentA(0.12)} 100%)`,
        }} />
        <div style={{ position: "absolute", left: 0, top: TAIL - 1, width: "100%", height: 2, background: C.accent }} />
      </div>
    );
  },
});
