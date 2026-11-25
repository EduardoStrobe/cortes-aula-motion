// "Debug" — ENGINE-OWNED diagnostic element AND the reference implementation of the element contract.
// Use it in a lab storyboard to check a slide rect / point / dock before drawing the real thing:
//   { "id": "dbg1", "el": "Debug", "at": { "w": "arco", "n": 1, "f": 158 }, "until": "end",
//     "props": { "rect": [880,380,1085,560], "pt": [990,450], "label": "RIBS", "dock": "BL", "pulses": [ { "f": 352 } ] } }
// It must never appear in a final storyboard (its dashed look is not part of the design system).
import { defineElement, frames, Txt, textWidth, type Anchor, type Dock, type Pt, type Rect } from "./api";

export interface DebugProps {
  /** slide rect: dashed 2 px white outline that follows the camera */
  rect?: Rect;
  /** slide point: accent cross (screen-constant size) + a screen-space dot placed with ctx.toScreen */
  pt?: Pt;
  /** text of the docked label */
  label?: string;
  dock?: Dock;
  /** outline pulses (stroke 2 -> 5 -> 2, 8 f) */
  pulses?: Anchor[];
  /** true = also request a tick on the beat's frame (to test cue scheduling) */
  tick?: boolean;
}

export const Debug = defineElement<DebugProps>({
  defaultUntil: "closing",
  cues: (beat) => (beat.props.tick ? [{ f: beat.at, cue: "tick" }] : []),

  // SLIDE layer: SVG nodes in slide px, inside the camera transform. Screen-constant sizes: ctx.px(n) or
  // vector-effect="non-scaling-stroke".
  Slide: ({ ctx }) => {
    const { props, frame, at, ease, tokens: { C, dim } } = ctx;
    const draw = ease.prog(frame, at, 8, ease.OUT);
    const sw = 2 + 3 * ease.bumps(frame, frames(ctx, props.pulses), 8);
    const a = ctx.px(14);
    return (
      <>
        {props.rect ? (
          <g opacity={draw}>
            <rect x={props.rect[0]} y={props.rect[1]} width={props.rect[2] - props.rect[0]} height={props.rect[3] - props.rect[1]}
              fill="none" stroke={dim(0.5)} strokeWidth={sw + 2} vectorEffect="non-scaling-stroke" />
            <rect x={props.rect[0]} y={props.rect[1]} width={props.rect[2] - props.rect[0]} height={props.rect[3] - props.rect[1]}
              fill="none" stroke={C.white} strokeWidth={sw} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />
          </g>
        ) : null}
        {props.pt ? (
          <path d={`M ${props.pt[0] - a} ${props.pt[1]} h ${2 * a} M ${props.pt[0]} ${props.pt[1] - a} v ${2 * a}`}
            stroke={C.accent} strokeWidth={ctx.px(3)} opacity={draw} />
        ) : null}
      </>
    );
  },

  // SCREEN layer: HTML positioned absolutely in CANVAS px (0..1080 x 0..1920), clipped by the stage.
  Screen: ({ ctx }) => {
    const { props, age, ease, tokens: { C } } = ctx;
    const k = ease.pop(age + 1);
    const text = `${props.label ?? ctx.beat.id}${ctx.closing.kept ? " · KEPT" : ""}`;
    const w = 22 + textWidth(text, { size: 28, tracking: 0.12, caps: true }) + 22;
    const d = ctx.dock(props.dock ?? "TL");
    const sp = props.pt ? ctx.toScreen(props.pt) : null;
    return (
      <>
        {props.label !== undefined || props.dock !== undefined ? (
          <div style={{
            position: "absolute", left: d.align === "right" ? d.x - w : d.x, top: d.y, width: w, height: 56, boxSizing: "border-box",
            borderRadius: 28, background: C.cardFill, border: `1px solid ${C.line}`, transform: `scale(${ease.lerp(0.9, 1, k)})`,
          }}>
            <Txt x={22} capCenter={27} size={28} tracking={0.12} caps>{text}</Txt>
          </div>
        ) : null}
        {sp ? (
          <div style={{ position: "absolute", left: sp[0] - 5, top: sp[1] - 5, width: 10, height: 10, borderRadius: 5, background: C.white }} />
        ) : null}
      </>
    );
  },
});
