// c4 "plantão" — cut module. OWNER: the c4 cut author.
//
// Prop = LaudoSheet (SYSTEM 8.22): a blank medical report. Line art in a 0..1 box: sheet 0.62 x 0.8 with a folded
// top-right corner, three text lines, ONE accent detail (the text caret). 2 px white strokes, transparent fill.
//
// Moves (unknown names are ignored):
//   write   the sheet's outline draws (10 f, clockwise from the top-left corner; the fold follows), then the three
//           text lines are written left to right, 4 f each, one after the other, with the caret leading the pen.
//           The outline only re-draws when the move starts on the frame the instance appears (a card landing) or
//           when args.outline === true; args.outline === false (or a sheet that is already there) writes the lines
//           only. After the last line the caret rests at the end of the text (steady).
//   erase   the lines un-draw right to left like a held backspace: bottom line first, 4 f each, 3 f stagger (10 f
//           in all), the caret riding the head of the line being deleted. Then the caret sits at the start of the
//           first line, gives one small pop (8 f) and blinks with a 15 f period: an empty report waiting.
// Before its first move an instance is the complete sheet with its three lines (the poster frame's token).
// A move starts from whatever the previous one left (an erase in the middle of a write removes what was written).
//
// Placements: token (84 px kicker row / 48 px HUD), card (132 px inside the PropCard) and film (>= 130 px over the
// radiograph: same drawing over a dim(0.5) under-stroke, like every other white mark on film).
import React from "react";
import {
  accentA, C, clamp01, defineElement, dim, FilmView, H, INOUT, makeView, OUT, PropSvg, W,
  type ElementDef, type Pt, type PropComponent, type PropMove, type Rect,
} from "../elements/api";

// ---- drawing (box units) ----------------------------------------------------------------------------------------
const X0 = 0.19;
const X1 = 0.81;
const Y0 = 0.1;
const Y1 = 0.9;
const FOLD = 0.17;
const OUTLINE = `M ${X0} ${Y0} H ${X1 - FOLD} L ${X1} ${Y0 + FOLD} V ${Y1} H ${X0} Z`;
const FOLD_PATH = `M ${X1 - FOLD} ${Y0} V ${Y0 + FOLD} H ${X1}`;
/** text lines: y, x start, x end */
const LINES: [number, number, number][] = [
  [0.45, 0.31, 0.69],
  [0.59, 0.31, 0.69],
  [0.73, 0.31, 0.55],
];
const CARET_H = 0.115;
const CARET_GAP = 0.05;

// ---- timing -----------------------------------------------------------------------------------------------------
const OUTLINE_F = 10;
const LINE_F = 4;
const ERASE_STAGGER = 3;
const ERASE_F = ERASE_STAGGER * 2 + LINE_F; // 10
const BLINK = 15;
const BLINK_ON = 8;

interface SheetState {
  /** 0..1 outline drawn; fold drawn */
  outline: number;
  fold: number;
  /** 0..1 of each text line, measured from its left end */
  lines: [number, number, number];
  /** line the caret is on, whether it is lit, and its size factor */
  caretLine: number;
  caretOn: boolean;
  caretScale: number;
}

const FULL: SheetState = { outline: 1, fold: 1, lines: [1, 1, 1], caretLine: 2, caretOn: true, caretScale: 1 };

const isMine = (m: PropMove) => m.name === "write" || m.name === "erase";

/** State after applying moves[0..k] at `frame` (frame >= moves[k].at). k = -1: the untouched sheet. */
const stateAt = (moves: PropMove[], k: number, frame: number, appear: number | undefined): SheetState => {
  if (k < 0) return FULL;
  const m = moves[k];
  const t = frame - m.at;
  const base = stateAt(moves, k - 1, m.at, appear);

  if (m.name === "write") {
    const flag = m.args?.outline;
    const withOutline = flag === true || (flag !== false && appear !== undefined && Math.abs(m.at - appear) <= 1);
    const od = withOutline ? OUTLINE_F : 0;
    const lines = [0, 1, 2].map((i) => clamp01((t + 1 - od - LINE_F * i) / LINE_F)) as [number, number, number];
    let caretLine = 2;
    for (let i = 0; i < 3; i++) {
      if (lines[i] < 1) {
        caretLine = i;
        break;
      }
    }
    return {
      outline: withOutline ? OUT(clamp01((t + 1) / (OUTLINE_F - 2))) : base.outline,
      fold: withOutline ? OUT(clamp01((t + 1 - (OUTLINE_F - 5)) / 5)) : base.fold,
      lines,
      caretLine,
      caretOn: t + 1 >= od,
      caretScale: 1,
    };
  }

  // erase
  const lines = [0, 1, 2].map((i) => base.lines[i] * (1 - clamp01((t + 1 - ERASE_STAGGER * (2 - i)) / LINE_F))) as [number, number, number];
  const had = base.lines.some((v) => v > 0);
  const done = had ? ERASE_F : 0;
  if (t + 1 < done) {
    // the caret stays on the lowest line that still has text (a held backspace)
    let caretLine = 0;
    for (let i = 2; i >= 0; i--) {
      if (lines[i] > 0) {
        caretLine = i;
        break;
      }
    }
    return { outline: base.outline, fold: base.fold, lines, caretLine, caretOn: true, caretScale: 1 };
  }
  const b = t + 1 - done; // frames since the sheet is empty
  const popK = b < 8 ? Math.sin((Math.PI * b) / 8) : 0;
  return {
    outline: base.outline, fold: base.fold, lines: [0, 0, 0], caretLine: 0,
    caretOn: b % BLINK < BLINK_ON, caretScale: 1 + 0.35 * popK,
  };
};

export const Prop: PropComponent = ({ size, placement, frame, moves, appear, color = C.white, accent = C.accent }) => {
  const mine = moves.filter(isMine);
  let k = -1;
  for (let i = 0; i < mine.length; i++) if (mine[i].at <= frame) k = i;
  const s = stateAt(mine, k, frame, appear);

  const [cy, cx0, cx1] = LINES[s.caretLine];
  const lv = s.lines[s.caretLine];
  const caretX = cx0 + (cx1 - cx0) * lv + CARET_GAP * Math.min(1, lv * 6);
  const caretH = (CARET_H / 2) * s.caretScale;
  const film = placement === "film";

  return (
    <PropSvg size={size}>
      {(sw) => {
        const dash = (v: number) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - v });
        const sheet = (stroke: string, w: number) => (
          <g stroke={stroke} strokeWidth={w}>
            {s.outline > 0 ? <path d={OUTLINE} {...dash(s.outline)} /> : null}
            {s.fold > 0 ? <path d={FOLD_PATH} {...dash(s.fold)} /> : null}
            {LINES.map(([y, x0, x1], i) =>
              s.lines[i] > 0.02 ? <line key={i} x1={x0} y1={y} x2={x0 + (x1 - x0) * s.lines[i]} y2={y} /> : null)}
          </g>
        );
        const caret = (stroke: string, w: number) =>
          s.caretOn && s.outline >= 1 ? (
            <line x1={caretX} y1={cy - caretH} x2={caretX} y2={cy + caretH} stroke={stroke} strokeWidth={w} />
          ) : null;
        return (
          <>
            {film ? sheet(dim(0.5), sw(4)) : null}
            {film ? caret(dim(0.5), sw(7)) : null}
            {sheet(color, sw(2))}
            {/* review: the 2-3 px caret blink was invisible on a phone (the silence at f 530-586 relies on it) */}
            {caret(accent, sw(placement === "token" ? 3 : 5))}
          </>
        );
      }}
    </PropSvg>
  );
};

// ---- cut-specific elements (review round 1) ------------------------------------------------------------------------
const ACC = accentA; // the accent token at alpha a (no new hue; live, follows the look's on-film palette)

// ScanBar: the engine's ScanLine at phone weight (3 px accent line + 120 px tail, accent 22 % -> 0; the 2 px line
// with a 12 % tail was "barely visible"). Sweeps the CURRENT stage rect top to bottom in `dur` frames and leaves
// through the bottom edge (the stage clips it). It crosses the whole picture, so it points at nothing.
interface ScanBarProps { dur: number; opacity?: number }
const SCAN_TAIL = 120;
const ScanBar = defineElement<ScanBarProps>({
  defaultUntil: (b) => b.at + b.props.dur,
  ownExit: true,
  Over: ({ ctx }) => {
    const { props, frame, at, stage } = ctx;
    if (frame < at || props.dur <= 0) return null;
    const y = stage.top + (stage.h * (frame - at)) / props.dur;
    if (y - SCAN_TAIL > stage.bottom) return null;
    return (
      <div style={{ position: "absolute", left: stage.left, top: y - SCAN_TAIL, width: stage.w, height: SCAN_TAIL + 3, opacity: props.opacity ?? 1 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: SCAN_TAIL, background: `linear-gradient(to bottom, ${ACC(0)} 0%, ${ACC(0.22)} 100%)` }} />
        <div style={{ position: "absolute", left: 0, top: SCAN_TAIL, width: "100%", height: 3, background: C.accent }} />
      </div>
    );
  },
});

// CursorPatch: his mouse arrow is parked over the image-right lower lung for f 0-119 (he points at nothing; it read
// as a pointer on the lung in the hook). The patch repaints `rect` (slide space) with the SAME film taken from
// footage frame `src`, where the arrow is hidden (cursor-c4.json: hidden f 120-915). FilmView paints films[] only.
interface CursorPatchProps { rect: Rect; src: number }
const CursorPatch = defineElement<CursorPatchProps>({
  ownExit: true,
  Under: ({ ctx }) => {
    const b = ctx.rectToScreen(ctx.props.rect);
    return (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -b.x, top: -b.y, width: W, height: H }}>
          <FilmView dir={ctx.dir} films={ctx.sb.films} view={ctx.view} videoFrame={ctx.props.src} />
        </div>
      </div>
    );
  },
});

// LightOn: the film is "switched on" like a light box in the first frames (dim level per frame after `at`, then
// nothing): a luminance jump in the first 0.2 s. The headline is not touched (it is outside the stage).
interface LightOnProps { levels: number[] }
const LightOn = defineElement<LightOnProps>({
  defaultUntil: (b) => b.at + b.props.levels.length,
  ownExit: true,
  Over: ({ ctx }) => {
    const { props, frame, at, stage } = ctx;
    const level = props.levels[frame - at];
    if (!level || level <= 0) return null;
    return <div style={{ position: "absolute", left: stage.left, top: stage.top, width: stage.w, height: stage.h, background: dim(level) }} />;
  },
});

// Lupa ("não estou vendo nada"): a magnifier that searches the film along a scripted path and finds nothing (same
// instrument and same S path over both lungs as ALT.md section 8). The lens shows the SAME film (FilmView, films[]
// only) at camera s x lens, capped at 2.0 screen px per slide px. It never stops on a structure: `path` is
// [frame, slide x, slide y][] travelled key to key (INOUT) and smoothed by a 13-frame triangular window; after the
// last key it shrinks and fades over the 6 exit frames. 6 px dim outer ring, 3 px white rim, one accent dot.
interface LupaProps { path: [number, number, number][]; d?: number; lens?: number }
const lupaPoint = (path: LupaProps["path"], f: number): Pt => {
  if (f <= path[0][0]) return [path[0][1], path[0][2]];
  for (let i = 1; i < path.length; i++) {
    if (f <= path[i][0]) {
      const t = INOUT((f - path[i - 1][0]) / (path[i][0] - path[i - 1][0]));
      return [path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t, path[i - 1][2] + (path[i][2] - path[i - 1][2]) * t];
    }
  }
  const l = path[path.length - 1];
  return [l[1], l[2]];
};
const Lupa = defineElement<LupaProps>({
  defaultUntil: (b) => b.props.path[b.props.path.length - 1][0],
  ownExit: true,
  cues: (beat) => [{ f: beat.at, cue: "pop", gainDb: -2 }],
  Screen: ({ ctx }) => {
    const { props, frame, at, stage } = ctx;
    if (frame < at) return null;
    const d0 = props.d ?? 300;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let k = -6; k <= 6; k++) {
      const w = 7 - Math.abs(k);
      const p = lupaPoint(props.path, frame + k);
      sx += p[0] * w;
      sy += p[1] * w;
      n += w;
    }
    const grow = OUT(clamp01((frame + 1 - at) / 8)) * (1 - 0.4 * ctx.exit);
    const m = d0 / 2 + 8;
    const raw = ctx.toScreen([sx / n, sy / n]);
    const x = Math.max(stage.left + m, Math.min(stage.right - m, raw[0]));
    const y = Math.max(stage.top + m, Math.min(stage.bottom - m, raw[1]));
    const centre = ctx.toSlide([x, y]);
    const mag = Math.min(2, ctx.cam.s * (props.lens ?? 1.8));
    const left = x - d0 / 2;
    const top = y - d0 / 2;
    const lensView = makeView({ cx: centre[0], cy: centre[1], s: mag }, { x: left, y: top, w: d0, h: d0 });
    const ring: React.CSSProperties = { position: "absolute", inset: 0, borderRadius: "50%", boxSizing: "border-box" };
    const a = Math.PI / 4;
    const dotR = d0 / 2 - 1.5;
    return (
      <div style={{ position: "absolute", left, top, width: d0, height: d0, transform: `scale(${grow})`, opacity: 1 - ctx.exit }}>
        <div style={{ ...ring, inset: -6, border: `6px solid ${dim(0.5)}` }} />
        <div style={{ ...ring, overflow: "hidden", background: C.graphite2 }}>
          <div style={{ position: "absolute", left: -left, top: -top, width: W, height: H }}>
            <FilmView dir={ctx.dir} films={ctx.sb.films} view={lensView} videoFrame={ctx.videoFrame} />
          </div>
        </div>
        <div style={{ ...ring, border: `3px solid ${C.white}` }} />
        <div style={{
          position: "absolute", left: d0 / 2 + dotR * Math.cos(a) - 8, top: d0 / 2 + dotR * Math.sin(a) - 8, width: 16, height: 16,
          borderRadius: "50%", background: C.accent,
        }} />
      </div>
    );
  },
});

// The FICHA compaction is the Chip's "compact" exit and the stage tilt is engine-owned.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const elements: Record<string, ElementDef<any>> = { ScanBar, CursorPatch, LightOn, Lupa };
