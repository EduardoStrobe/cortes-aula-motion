// Compare — SYSTEM 8.18 (c1). OWNER: slide-group element author.
// Two film layers. Layer A is the stage itself: the storyboard's camera track must be on camera `a` while the
// beat lives (the element does not move the stage camera). Layer B is a second FilmView through camera `b`,
// visible only LEFT of a vertical 1 px white divider whose screen x follows `sweeps` (INOUT per sweep; between
// sweeps it holds the last x1; before the first sweep it sits on that sweep's x0).
// Two mini pills (h 36, 22 px caps +0.12em, cardFill, 1 px line border) ride the divider 16 px below the stage
// top: labels[0] left of it (it names layer B), labels[1] right of it (it names layer A).
//
// How layer B is built (`Under` layer, below every mark, so a kept ring stays on top of both films):
//   - an opaque `graphite2` backing over the stage area left of the divider (otherwise film A would show wherever
//     film B does not cover it);
//   - FilmView with ctx.sb.films (it can only ever paint films[]; c1's profile films are not in it) at
//     ctx.videoFrame, dimmed with the stage in the closing;
//   - the storyboard's PATCHES again, in layer B's view (c1's handwriting patch on film B must also be on in the
//     compare layer; the stage only draws patches for layer A).
//   Layer B is LOCKED to the stage picture: its view is the current stage view composed with the fixed relation
//   between `a` and `b`, so camera drift, a punch or a moving stage edge can never slide B against A (object B
//   stays exactly on object A, which is the whole point of c1 beat 13).
// Safe zone: the pills ride the divider but never leave x 60..940 (the stage docks): the left pill's right edge is
// capped at x 940 and the right pill's left edge at x 60, so with the divider at a stage edge the pill of the
// layer that fills the stage is parked in the top corner and still names it. The other pill fades out over the
// last 16 px before it would touch x 60 / x 960 instead of being cut by the stage edge or read outside the safe
// area.
// The divider and pills fade in over 4 f; the engine fades everything over the 6 f after `until`.
import React from "react";
import {
  defineElement, FilmView, numCam, rectToScreen, textWidth, Txt, type Cam, type ElCtx, type Storyboard, type View,
} from "../api";

type PatchLike = NonNullable<Storyboard["patches"]>[number];

export interface CompareProps {
  a: Cam;
  b: Cam;
  /** divider travel: absolute frames, screen x */
  sweeps: { from: number; to: number; x0: number; x1: number }[];
  labels: [string, string];
  /** [added by the c1 cut author, optional] where the two pills ride the divider: "top" (default: 16 px below the
   *  stage top) or "bottom" (16 px above the stage bottom; c1: the top of the film holds the object under
   *  discussion, which no label may cover). */
  labelsAt?: "top" | "bottom";
  /** [added by the c1 cut author, optional] film ids layer B may paint (default: every film of the storyboard).
   *  c1 uses ["B"] so the bottom strip of film A does not peek in at the top of layer B. */
  bFilms?: string[];
  /** [review round 1, c1 cut author, optional] "chip" = the two pills at chip size (h 56, 28 px type) instead of the
   *  36 px / 22 px mini pills, which were the only cue to which film is which and too small on a phone. */
  pill?: "chip";
}

const PILL_MINI = { h: 36, size: 22, tracking: 0.12, pad: 14, gap: 10, top: 16 };
const PILL_CHIP = { h: 56, size: 28, tracking: 0.12, pad: 20, gap: 12, top: 16 };
const pillOf = (p: CompareProps) => (p.pill === "chip" ? PILL_CHIP : PILL_MINI);

const dividerX = (ctx: ElCtx<CompareProps>): number => {
  const sw = [...ctx.props.sweeps].sort((p, q) => p.from - q.from);
  if (!sw.length) return ctx.stage.left;
  let x = sw[0].x0;
  for (const s of sw) {
    if (ctx.frame >= s.from) x = ctx.ease.lerp(s.x0, s.x1, ctx.ease.prog(ctx.frame, s.from, s.to - s.from, ctx.ease.INOUT));
  }
  return Math.max(ctx.stage.left, Math.min(ctx.stage.right, x));
};

/** Layer B's view: the CURRENT stage view composed with the nominal relation between cameras a and b. */
const viewB = (ctx: ElCtx<CompareProps>): View => {
  const { stage, view } = ctx;
  const A = numCam(ctx.props.a, stage.cx, stage.cy);
  const B = numCam(ctx.props.b, stage.cx, stage.cy);
  const ratio = B.s / A.s;
  const s = view.s * ratio;
  const ox = view.ox + (A.cx - B.cx * ratio) * view.s;
  const oy = view.oy + (A.cy - B.cy * ratio) * view.s;
  const rect = view.rect;
  return { rect, s, ox, oy, cx: (rect.x + rect.w / 2 - ox) / s, cy: (rect.y + rect.h / 2 - oy) / s };
};

/** A storyboard patch drawn in an arbitrary view (same look as the stage's own patches, SYSTEM 3.2). */
const PatchB: React.FC<{ p: PatchLike; ctx: ElCtx<CompareProps>; view: View }> = ({ p, ctx, view }) => {
  const { C } = ctx.tokens;
  const b = rectToScreen(view, p.rect);
  if (p.fill === "filmBlack") {
    return <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, background: C.filmBlack }} />;
  }
  const film = ctx.sb.films.find((f) => p.rect[0] < f.rect[2] && p.rect[2] > f.rect[0] && p.rect[1] < f.rect[3] && p.rect[3] > f.rect[1]);
  const fr = film ? film.rect : p.rect;
  const inner = { l: p.rect[0] > fr[0] + 3, t: p.rect[1] > fr[1] + 3, r: p.rect[2] < fr[2] - 3, b: p.rect[3] < fr[3] - 3 };
  const bd = (on: boolean) => (on ? `1px solid ${C.line}` : "none");
  const rad = (m: boolean, n: boolean) => (m && n ? 12 : 0);
  return (
    <div style={{
      position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: "border-box", background: C.graphite2,
      borderLeft: bd(inner.l), borderTop: bd(inner.t), borderRight: bd(inner.r), borderBottom: bd(inner.b),
      borderRadius: `${rad(inner.t, inner.l)}px ${rad(inner.t, inner.r)}px ${rad(inner.b, inner.r)}px ${rad(inner.b, inner.l)}px`,
    }} />
  );
};

const Pill: React.FC<{ ctx: ElCtx<CompareProps>; text: string; left: number; width: number; opacity: number }> = ({ ctx, text, left, width, opacity }) => {
  const { C } = ctx.tokens;
  const PILL = pillOf(ctx.props);
  if (opacity <= 0) return null;
  return (
    <div style={{
      position: "absolute", left, width, height: PILL.h, boxSizing: "border-box",
      top: ctx.props.labelsAt === "bottom" ? ctx.stage.bottom - PILL.top - PILL.h : ctx.stage.top + PILL.top,
      borderRadius: PILL.h / 2, background: C.cardFill, border: `1px solid ${C.line}`, opacity,
    }}>
      <Txt x={PILL.pad - 1} capCenter={PILL.h / 2 - 1} size={PILL.size} tracking={PILL.tracking} caps>{text}</Txt>
    </div>
  );
};

export const Compare = defineElement<CompareProps>({
  defaultUntil: "closing",

  Under: ({ ctx }) => {
    const { stage, tokens: { C, W, H } } = ctx;
    const w = dividerX(ctx) - stage.left;
    if (w <= 0) return null;
    const vb = viewB(ctx);
    return (
      <div style={{ position: "absolute", left: stage.left, top: stage.top, width: w, height: stage.h, overflow: "hidden", background: C.graphite2 }}>
        <div style={{ position: "absolute", left: -stage.left, top: -stage.top, width: W, height: H }}>
          <FilmView dir={ctx.dir} films={ctx.sb.films} only={ctx.props.bFilms} view={vb} videoFrame={ctx.videoFrame} brightness={1 - ctx.closing.filmDim * ctx.closing.dim} />
          {(ctx.sb.patches ?? []).map((p, i) => <PatchB key={i} p={p} ctx={ctx} view={vb} />)}
        </div>
      </div>
    );
  },

  Screen: ({ ctx }) => {
    const { props, frame, at, ease, stage, tokens: { C, Z } } = ctx;
    const x = dividerX(ctx);
    const PILL = pillOf(props);
    const appear = ease.clamp01((frame + 1 - at) / 4);
    const style = { size: PILL.size, tracking: PILL.tracking, caps: true };
    const wl = 2 * PILL.pad + textWidth(props.labels[0], style);
    const wr = 2 * PILL.pad + textWidth(props.labels[1], style);
    const dockL = stage.left + 20;
    const dockR = Math.min(stage.right - 20, Z.safeRight - 20);
    const leftL = Math.min(x - PILL.gap, dockR) - wl;
    const leftR = Math.max(x + PILL.gap, dockL);
    const lineOn = x > stage.left + 1 && x < stage.right - 1;
    return (
      <div style={{ position: "absolute", left: 0, top: 0, opacity: appear }}>
        {lineOn ? <div style={{ position: "absolute", left: x - 0.5, top: stage.top, width: 1, height: stage.h, background: C.white }} /> : null}
        <Pill ctx={ctx} text={props.labels[0]} left={leftL} width={wl} opacity={ease.clamp01((leftL - dockL) / 16)} />
        <Pill ctx={ctx} text={props.labels[1]} left={leftR} width={wr} opacity={ease.clamp01((Z.safeRight - (leftR + wr)) / 16)} />
      </div>
    );
  },
});
