// Stage (SYSTEM 2, 3): the rounded container with the film (FilmClip), patches, covers, the element layers
// (Under / Slide / Screen), JoinBlink, and the hook panes (PaneSplit). ENGINE-OWNED.
// Z-order inside a view, bottom to top: film, patches, covers, elements' Under, slide-space SVG marks, cover
// labels, elements' Screen, JoinBlink.
import React, { useMemo } from "react";
import { rectToScreen, viewSvg, type ScreenRect, type View } from "../camera";
import { EXIT_FRAMES, isAlive, makeCtx } from "../elements/context";
import type { ElCtx } from "../elements/types";
import { Txt, textWidth } from "../fonts";
import type { Resolved, ResolvedBeat, ResolvedCover, StageRect } from "../resolve";
import { panesActive, paneAt, scrimsAt, stageAt, stageViewAt, tiltAt } from "../timeline";
import { bumps, C, CHIP_H, CHIP_SIZE, clamp01, FILM_DIM, H, lerp, pop, prog, W } from "../tokens";
import type { Film, PatchSpec } from "../types";
import { FilmView } from "./FilmView";
import { hookHead } from "./Hud";
import { StageScrims } from "./Looks";

const canvas: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: W, height: H };

// ---- patches (SYSTEM 3.2) --------------------------------------------------------------------------------------
const Patch: React.FC<{ p: PatchSpec; films: Film[]; view: View }> = ({ p, films, view }) => {
  const b = rectToScreen(view, p.rect);
  if (p.fill === "filmBlack") {
    return <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, background: C.filmBlack }} />;
  }
  // an edge is "inner" when it runs across a film (not along / beyond the film's own edge)
  const film = films.find((f) => p.rect[0] < f.rect[2] && p.rect[2] > f.rect[0] && p.rect[1] < f.rect[3] && p.rect[3] > f.rect[1]);
  const fr = film ? film.rect : p.rect;
  const inner = {
    l: p.rect[0] > fr[0] + 3, t: p.rect[1] > fr[1] + 3, r: p.rect[2] < fr[2] - 3, b: p.rect[3] < fr[3] - 3,
  };
  const bd = (on: boolean) => (on ? `1px solid ${C.line}` : "none");
  const rad = (a: boolean, c: boolean) => (a && c ? 12 : 0);
  return (
    <div style={{
      position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: "border-box",
      background: C.graphite2, borderLeft: bd(inner.l), borderTop: bd(inner.t), borderRight: bd(inner.r),
      borderBottom: bd(inner.b),
      borderRadius: `${rad(inner.t, inner.l)}px ${rad(inner.t, inner.r)}px ${rad(inner.b, inner.r)}px ${rad(inner.b, inner.l)}px`,
    }} />
  );
};

// ---- covers (SYSTEM 3.2, 8.4) ----------------------------------------------------------------------------------
export const LockGlyph: React.FC<{ size?: number; rot?: number; color?: string }> = ({ size = 24, rot = 0, color = C.text2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", transform: `rotate(${rot}deg)`, flex: "none" }}>
    <rect x={5} y={10.5} width={14} height={10} rx={2} fill="none" stroke={color} strokeWidth={1.5} />
    <path d="M 8 10.5 V 7.5 A 4 4 0 0 1 16 7.5 V 10.5" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);
const shakeX = (frame: number, shakes: number[]) => {
  for (const s of shakes) {
    const d = frame - s;
    if (d >= 0 && d < 12) return 6 * Math.sin((d / 12) * Math.PI * 2 * 3);
  }
  return 0;
};
const rockDeg = (frame: number, shakes: number[]) => {
  for (const s of shakes) {
    const d = frame - s;
    if (d >= 0 && d < 10) return 6 * Math.sin((d / 10) * Math.PI * 2 * 2);
  }
  return 0;
};
const CoverCard: React.FC<{ c: ResolvedCover; view: View; frame: number; opacity: number }> = ({ c, view, frame, opacity }) => {
  const b = rectToScreen(view, c.rect);
  const labelOn = frame >= c.at;
  return (
    <div style={{
      position: "absolute", left: b.x + shakeX(frame, c.shakes), top: b.y, width: b.w, height: b.h, boxSizing: "border-box",
      background: C.graphite2, border: `1px solid ${C.line}`, borderRadius: 16, opacity,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {labelOn ? null : <LockGlyph rot={rockDeg(frame, c.shakes)} />}
    </div>
  );
};
const CHIP = { h: CHIP_H, size: CHIP_SIZE, tracking: 0.12 };
const CoverLabel: React.FC<{ c: ResolvedCover; view: View; frame: number; r: Resolved; opacity: number }> = ({ c, view, frame, r, opacity }) => {
  if (frame < c.at) return null;
  const fade = c.labelKept ? 1 : 1 - clamp01((frame - r.T) / EXIT_FRAMES);
  if (fade <= 0) return null;
  const b = rectToScreen(view, c.rect);
  const tw = textWidth(c.label, { size: CHIP.size, tracking: CHIP.tracking, caps: true });
  const w = 22 + 24 + 10 + 12 + 12 + tw + 22;
  const k = pop(frame - c.at + 1);
  const dot = 1 + 0.5 * Math.max(bumps(frame, [c.at], 8), bumps(frame, c.pulses, 8));
  const cx = b.x + b.w / 2 + shakeX(frame, c.shakes);
  const cy = b.y + b.h / 2;
  return (
    <div style={{
      position: "absolute", left: cx - w / 2, top: cy - CHIP.h / 2, width: w, height: CHIP.h, boxSizing: "border-box",
      borderRadius: CHIP.h / 2, background: C.cardFill, border: `1px solid ${C.line}`,
      opacity: opacity * fade * clamp01((frame - c.at + 1) / 4), transform: `scale(${lerp(0.9, 1, k)})`,
    }}>
      <div style={{ position: "absolute", left: 22, top: (CHIP.h - 24) / 2 - 1 }}><LockGlyph rot={rockDeg(frame, c.shakes)} /></div>
      <div style={{
        position: "absolute", left: 22 + 24 + 10, top: (CHIP.h - 12) / 2 - 1, width: 12, height: 12, borderRadius: 6,
        background: C.accent, transform: `scale(${dot})`,
      }} />
      <Txt x={22 + 24 + 10 + 12 + 12} capCenter={CHIP.h / 2 - 1} size={CHIP.size} tracking={CHIP.tracking} caps>{c.label}</Txt>
    </div>
  );
};

// ---- JoinBlink (SYSTEM 3.3 / 8.20) -----------------------------------------------------------------------------
const JoinBlink: React.FC<{ joins: number[]; frame: number; st: StageRect }> = ({ joins, frame, st }) => {
  for (const j of joins) {
    const d = frame - j;
    if (d >= 0 && d < 6) {
      const x = lerp(st.left, st.right, (d + 0.5) / 6);
      return <div style={{ position: "absolute", left: x - 1, top: st.top, width: 2, height: st.h, background: C.accent }} />;
    }
  }
  return null;
};

// ---- element layers --------------------------------------------------------------------------------------------
const wrap = (ctx: ElCtx): React.CSSProperties =>
  ({ ...canvas, opacity: ctx.beat.def.ownExit ? undefined : ctx.opacity });

const ElementLayers: React.FC<{ ctxs: ElCtx[]; view: View; mid?: React.ReactNode }> = ({ ctxs, view, mid }) => (
  <>
    {ctxs.map((ctx) => {
      const L = ctx.beat.def.Under;
      return L ? <div key={ctx.beat.id} style={wrap(ctx)}><L ctx={ctx} /></div> : null;
    })}
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ ...canvas, overflow: "hidden" }}>
      <g transform={viewSvg(view)}>
        {ctxs.map((ctx) => {
          const L = ctx.beat.def.Slide;
          return L ? <g key={ctx.beat.id} opacity={ctx.beat.def.ownExit ? undefined : ctx.opacity}><L ctx={ctx} /></g> : null;
        })}
      </g>
    </svg>
    {mid}
    {ctxs.map((ctx) => {
      const L = ctx.beat.def.Screen;
      return L ? <div key={ctx.beat.id} style={wrap(ctx)}><L ctx={ctx} /></div> : null;
    })}
    {ctxs.map((ctx) => {
      const L = ctx.beat.def.Over;
      return L ? <div key={ctx.beat.id} style={wrap(ctx)}><L ctx={ctx} /></div> : null;
    })}
  </>
);

/** A clipped, rounded box whose children are positioned in CANVAS px.
 *  [looks] `line`: CSS border instead of the default 1 px white line (null = no border); `shadow`: box-shadow. */
export const ClipBox: React.FC<{
  rect: ScreenRect; radius: number; bg?: string; border?: number; opacity?: number; transform?: string;
  line?: string | null; shadow?: string | null;
  children?: React.ReactNode;
}> = ({ rect, radius, bg = C.graphite2, border = 1, opacity, transform, line, shadow, children }) => (
  <div style={{
    position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: radius,
    overflow: "hidden", background: bg, opacity, transform, transformOrigin: "50% 50%", boxShadow: shadow ?? undefined,
  }}>
    <div style={{ position: "absolute", left: -rect.x, top: -rect.y, width: W, height: H }}>{children}</div>
    {border > 0 && line !== null ? (
      <div style={{
        position: "absolute", inset: 0, borderRadius: radius, border: line ?? `1px solid rgba(255,255,255,${0.1 * border})`,
        boxSizing: "border-box",
      }} />
    ) : null}
  </div>
);

const rectAsStage = (b: ScreenRect): StageRect =>
  ({ left: b.x, right: b.x + b.w, top: b.y, bottom: b.y + b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2, w: b.w, h: b.h });

export const Stage: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const { sb } = r;
  const st = stageAt(r, frame);
  const view = stageViewAt(r, frame);
  const videoFrame = Math.min(frame, sb.freezeStageAt ?? Infinity, r.T - 1);
  const brightness = 1 - FILM_DIM * clamp01((frame - r.T) / 12);
  const panes = panesActive(r, frame);
  const stageOpacity = r.hook.panes ? prog(frame, r.H, 8) : 1;
  const coverOpacity = r.hook.panes ? prog(frame, r.H + 8, 8) : 1;
  const alive = (b: ResolvedBeat) => isAlive(b, frame);
  const stageCtxs = r.beats.filter((b) => b.pane === null && alive(b)).map((b) => makeCtx(r, b, frame, view, st));
  // [looks] chrome of the stage card; a full-bleed look paints the whole frame instead of the box and puts graphite
  // scrims between the picture and the element layers
  const { look } = r;
  const bleed = look.layout.bleed;
  const head = useMemo(() => (bleed ? hookHead(r) : null), [r, bleed]);
  const scrims = head ? scrimsAt(r, frame, head.capTop, head.bottom) : null;
  const FRAME: ScreenRect = { x: 0, y: 0, w: W, h: H };

  return (
    <>
      {stageOpacity > 0 ? (
        <ClipBox rect={bleed ? FRAME : view.rect} radius={bleed ? 0 : 28} opacity={stageOpacity} transform={tiltAt(r, frame)}
          bg={look.stage.bg ?? undefined} line={look.stage.border} shadow={look.stage.shadow}>
          {panes ? null : <FilmView dir={r.dir} films={sb.films} view={view} videoFrame={videoFrame} brightness={brightness} />}
          {panes ? null : (sb.patches ?? []).map((p, i) => <Patch key={i} p={p} films={sb.films} view={view} />)}
          {r.covers.map((c) => <CoverCard key={c.id} c={c} view={view} frame={frame} opacity={coverOpacity} />)}
          {scrims ? <StageScrims s={scrims} color={look.bg.color} /> : null}
          <ElementLayers
            ctxs={stageCtxs}
            view={view}
            mid={r.covers.map((c) => <CoverLabel key={c.id} c={c} view={view} frame={frame} r={r} opacity={coverOpacity} />)}
          />
          <JoinBlink joins={r.joins} frame={frame} st={st} />
        </ClipBox>
      ) : null}
      {panes ? (r.hook.panes ?? []).map((_, i) => {
        const p = paneAt(r, i, frame);
        const pst = rectAsStage(p.view.rect);
        const ctxs = r.beats.filter((b) => b.pane === i && alive(b)).map((b) => makeCtx(r, b, frame, p.view, pst));
        return (
          <ClipBox key={i} rect={p.view.rect} radius={lerp(28, 4, p.merge)} bg={`rgba(30,34,40,${1 - p.merge})`} border={1 - p.merge}
            line={look.stage.border} shadow={p.merge > 0 ? null : look.stage.shadow}>
            <FilmView dir={r.dir} films={sb.films} only={p.films} view={p.view} videoFrame={videoFrame} brightness={brightness} />
            {(sb.patches ?? []).map((pt, k) => <Patch key={k} p={pt} films={sb.films.filter((f) => p.films.includes(f.id))} view={p.view} />)}
            <ElementLayers ctxs={ctxs} view={p.view} />
          </ClipBox>
        );
      }) : null}
    </>
  );
};
