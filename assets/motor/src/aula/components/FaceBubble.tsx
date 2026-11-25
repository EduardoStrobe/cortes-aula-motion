// Camera block (client request after the first v2 render: "deixa o bloco da câmera dele maior, pois corta o rosto
// dele em algumas partes"). It REPLACES the circular face bubble of SYSTEM 3.4 in the primary format:
//   a rounded rectangle (Z.cam: 230 x 230 px at x 60, y 1238, radius 28, 1 px line border) that shows a 262 x 262
//   px window of the webcam tile. The window follows the head horizontally (face-track.json cx when the cut has
//   one, else the face.json keys; clamped to the tile) AND vertically: upright it shows tile rows 4..266 (just
//   above the burned-in "Nome do Apresentador" label at x 14-134, y 271-293); when he leans in, his mouth and chin sit
//   below row 266 (c2 f 0, c5 f 112, c1 f 700), so the window slides down as far as the tile's last row and the
//   label is painted out by an opaque tab pinned to it (it can never be visible). Nothing of his face is cropped
//   by the block itself: what is missing is outside the webcam tile.
//   Speaking indicator = an accent segment along the block's border (top-right corner), re-pop on joins,
//   face-lost fallback to a still (hard switch + re-pop, slow push-in on the still), closing freeze, name tag.
// ENGINE-OWNED. Exports for ALT: <CamCrop> (any w x h; same framing rule), camCx, speakingLevel; the legacy circle
// <FaceCrop> / faceCx are kept only so the ALT bubble keeps compiling until its owner switches to <CamCrop>.
import React from "react";
import { Freeze, OffthreadVideo, staticFile } from "remotion";
import { Txt, textWidth } from "../fonts";
import { inkAt } from "../look";
import type { Resolved } from "../resolve";
import { bumps, C, CAM_PROXY, clamp01, FPS, INOUT, lerp, OUT, prog, Z } from "../tokens";
import type { FaceData, Palavra } from "../types";

/** Crop centre x (tile-local px) at frame f: linear interpolation of the 15-frame keys of face.json. */
export const faceCx = (face: FaceData, f: number): number => {
  const k = face.keys;
  if (f <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (f <= k[i][0]) {
      const t = (f - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return lerp(k[i - 1][1], k[i][1], t);
    }
  }
  return k[k.length - 1][1];
};

/** Tile width (417 px; the proxy has one extra column on the left). */
const TILE_W = CAM_PROXY.w + CAM_PROXY.dx;

/** Head centre x (tile-local px) at frame f for the camera block: the head track (face-track.json, every `step`
 *  frames, linear in between) when the cut has one, else the face.json keys. NOT clamped: <CamCrop> clamps it to
 *  what its own window width allows. */
export const camCx = (face: FaceData, f: number): number => {
  const t = face.track;
  if (!t || !t.pts.length) return faceCx(face, f);
  const x = Math.max(0, f) / t.step;
  const i = Math.min(t.pts.length - 1, Math.floor(x));
  const j = Math.min(t.pts.length - 1, i + 1);
  return lerp(t.pts[i][0], t.pts[j][0], clamp01(x - i));
};

/** Top row (tile-local px) of the block's window at frame f: Z.cam.srcY0 (4) while his head is upright (track cy
 *  <= 146), sliding down 1 : 1 with the head to at most srcYMax - 262 (40) when he leans in. Cuts without a head
 *  track stay at 4. */
export const camY0 = (face: FaceData, f: number): number => {
  const { srcY0, srcY1, srcYMax } = Z.cam;
  const t = face.track;
  if (!t || !t.pts.length) return srcY0;
  const x = Math.max(0, f) / t.step;
  const i = Math.min(t.pts.length - 1, Math.floor(x));
  const j = Math.min(t.pts.length - 1, i + 1);
  const cy = lerp(t.pts[i][1], t.pts[j][1], clamp01(x - i));
  return Math.max(srcY0, Math.min(srcYMax - (srcY1 - srcY0), srcY0 + (cy - 146)));
};

/** 0..1: share of the last 6 frames in which a word was being spoken (gives the 6-frame linear transitions). */
export const speakingLevel = (palavras: Palavra[], frame: number): number => {
  let n = 0;
  for (let f = frame - 5; f <= frame; f++) {
    const t = f / FPS;
    if (palavras.some((p) => t >= p.s && t < p.e)) n++;
  }
  return n / 6;
};

/** The webcam tile through the camera-block framing: 262 tile rows fill the box height (rows camY0 .. camY0 + 262,
 *  see camY0), the window is centred on the head (camCx) and clamped so it never leaves the tile, and the burned-in
 *  name label is covered by an opaque tab whenever the window reaches it. Any box size works (ALT); a box wider
 *  than 417 / 262 x its height would show the tile's side edges, so keep w <= 1.59 x h.
 *  `zoom` scales the picture about the box centre (>= 1 only). */
export const CamCrop: React.FC<{
  dir: string; face: FaceData; videoFrame: number; w: number; h: number; radius: number; zoom?: number; opacity?: number;
}> = ({ dir, face, videoFrame, w, h, radius, zoom = 1, opacity }) => {
  const { srcY0, srcY1, label } = Z.cam;
  const k = h / (srcY1 - srcY0);
  const half = Math.min(w / k, TILE_W) / 2;
  const cx = Math.max(half, Math.min(TILE_W - half, camCx(face, videoFrame)));
  const y0 = camY0(face, videoFrame);
  // the label tab: everything left of tile x `label.x1` and below tile y `label.y0`, in box px
  const tabW = Math.ceil(w / 2 + (label.x1 - cx) * k);
  const tabTop = Math.floor((label.y0 - y0) * k);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, borderRadius: radius, overflow: "hidden", opacity, background: C.graphite2 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transform: `scale(${Math.max(1, zoom)})`, transformOrigin: "50% 45%" }}>
        <Freeze frame={Math.max(0, Math.round(videoFrame))}>
          <OffthreadVideo
            muted
            src={staticFile(`${dir}/cam.mp4`)}
            style={{
              position: "absolute", width: CAM_PROXY.w * k, height: CAM_PROXY.h * k, maxWidth: "none",
              left: w / 2 - (cx - CAM_PROXY.dx) * k, top: -(y0 - CAM_PROXY.dy) * k,
            }}
          />
        </Freeze>
        {tabW > 0 && tabTop < h ? (
          <div style={{
            position: "absolute", left: -2, top: tabTop, width: tabW + 2, height: h - tabTop + 2, background: C.graphite2,
            borderTopRightRadius: 10, borderTop: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`, boxSizing: "border-box",
          }} />
        ) : null}
      </div>
    </div>
  );
};

/** LEGACY (ALT only): circular crop of cam.mp4, radius `face.r` source px around tile-local (cx, face.cy), shown
 *  at diameter d. With cy 146 and r 118 the circle spans tile y 28..264 and can never include the burned-in name
 *  label (tile y 271-293). It cuts his face whenever he leans in: use <CamCrop> instead. */
export const FaceCrop: React.FC<{ dir: string; face: FaceData; videoFrame: number; d: number; zoom?: number; opacity?: number }> =
  ({ dir, face, videoFrame, d, zoom = 1, opacity }) => {
    const k = d / (2 * face.r);
    const cx = faceCx(face, videoFrame);
    return (
      <div style={{ position: "absolute", left: 0, top: 0, width: d, height: d, borderRadius: "50%", overflow: "hidden", opacity }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: d, height: d, transform: `scale(${zoom})`, transformOrigin: "50% 50%" }}>
          <Freeze frame={Math.max(0, Math.round(videoFrame))}>
            <OffthreadVideo
              muted
              src={staticFile(`${dir}/cam.mp4`)}
              style={{
                position: "absolute", width: CAM_PROXY.w * k, height: CAM_PROXY.h * k, maxWidth: "none",
                left: d / 2 - (cx - CAM_PROXY.dx) * k, top: d / 2 - (face.cy - CAM_PROXY.dy) * k,
              }}
            />
          </Freeze>
        </div>
      </div>
    );
  };

/** Rounded-rect outline starting on the top edge at x = w * start, clockwise (pathLength is set to 100 by the
 *  caller, so a dash array in percent of the perimeter draws a segment from there). `inset` = distance from the
 *  box edge to the stroke centre. */
export const camOutline = (w: number, h: number, radius: number, inset: number, start = 0.5): string => {
  const r = Math.max(0, radius - inset);
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const sx = Math.max(x0 + r, Math.min(x1 - r, w * start));
  return `M ${sx} ${y0} H ${x1 - r} A ${r} ${r} 0 0 1 ${x1} ${y0 + r} V ${y1 - r} A ${r} ${r} 0 0 1 ${x1 - r} ${y1}`
    + ` H ${x0 + r} A ${r} ${r} 0 0 1 ${x0} ${y1 - r} V ${y0 + r} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} H ${sx}`;
};

/** Frames after a switch (join, face-lost in / out) over which the block re-pops. */
const REPOP = 8;
/** [looks] frames the block takes to travel from layout.hookCam (hook) to Z.cam, starting on H. */
export const CAM_TRAVEL = 18;
/** [looks] the camera block's rect at `frame`: Z.cam, or the look's hook rect until H and the trip down after it. */
export const camRectAt = (r: Resolved, frame: number): { x: number; y: number; w: number; h: number; radius: number; m: number } => {
  const hc = r.look.layout.hookCam;
  const { x, y, w, h, radius } = Z.cam;
  if (!hc) return { x, y, w, h, radius, m: 1 };
  const m = prog(frame, r.H, CAM_TRAVEL, INOUT);
  return { x: lerp(hc.x, x, m), y: lerp(hc.y, y, m), w: lerp(hc.w, w, m), h: lerp(hc.h, h, m), radius: lerp(hc.radius, radius, m), m };
};

export const FaceBubble: React.FC<{ r: Resolved; frame: number; unitStarts: number[] }> = ({ r, frame, unitStarts }) => {
  const { x, y, w, h, radius, m } = camRectAt(r, frame);
  const ink = inkAt(r.look, y + h / 2);
  const big = r.look.layout.hookCam !== null;
  const face = r.face;
  const live = frame < r.T ? frame : (r.sb.closing.faceStill ?? r.T - 1);
  // face-lost fallback: the block SWITCHES to a still with open eyes for the interval (a hard switch with a re-pop
  // reads as a camera cut; the old 6-frame cross-fade showed two ghosted heads) and pushes in slowly so the still
  // never reads as a freeze. Intervals: face-track.json / face.json + the storyboard's own ([ext] sb.face.lost).
  let still: number | null = null;
  let zoom = 1;
  const pops: number[] = [...r.joins];
  if (frame < r.T) {
    const lost: (readonly [number, number, number?])[] = [...face.lost, ...(r.sb.face.lost ?? [])];
    for (const [a, b, st] of lost) {
      pops.push(a, b + 1);
      if (frame >= a && frame <= b) {
        still = st ?? r.sb.face.still;
        zoom = lerp(1, 1.05, clamp01((frame - a) / Math.max(1, b - a)));
      }
    }
  }
  let scale = 1;
  for (const j of pops) {
    if (frame >= j && frame < j + REPOP && j > 0 && j < r.T) scale = Math.min(scale, lerp(0.9, 1, prog(frame, j, REPOP, OUT)));
  }
  // speaking indicator: accent segment round the top-right corner; longer and brighter while he speaks, a short
  // eased swell (6 f) when a caption unit lands
  const speak = frame < r.T ? speakingLevel(r.data.palavras, frame) : 0;
  const arcOp = frame < r.T ? 0.3 + 0.7 * speak : lerp(0.3, 0, clamp01((frame - r.T) / 6));
  const swell = frame < r.T ? bumps(frame, unitStarts, 6) : 0;
  const seg = lerp(16, 30, speak);
  // [looks] with a big hook block the tag under the bottom block only exists once the block has arrived there
  const tagOp = (1 - prog(frame, r.T + 20, 6)) * (big ? prog(frame, r.H + CAM_TRAVEL, 6) : 1);
  const pillOp = big ? 1 - prog(frame, r.H - 3, 3) : 0;
  return (
    <>
      <div style={{
        position: "absolute", left: x, top: y, width: w, height: h, transform: `scale(${scale})`, transformOrigin: "50% 50%",
        borderRadius: ink.cam.shadow ? radius : undefined, boxShadow: ink.cam.shadow ?? undefined,
      }}>
        <CamCrop dir={r.dir} face={face} videoFrame={still ?? live} w={w} h={h} radius={radius} zoom={zoom} />
        {ink.cam.border ? (
          <div style={{ position: "absolute", inset: 0, borderRadius: radius, border: ink.cam.border, boxSizing: "border-box" }} />
        ) : null}
        {pillOp > 0 && m <= 0 ? (
          // [looks] name tag of the big hook block: a white pill in its bottom-left corner (where the burned-in
          // label of the webcam tile is painted out), away from his face
          <div style={{
            position: "absolute", left: 24, top: h - 24 - 50, height: 50, borderRadius: 25, background: "#FFFFFF", opacity: pillOp,
            width: textWidth("NOME DO APRESENTADOR", { size: 26, tracking: 0.14, caps: true }) + 44,
          }}>
            <Txt x={22} capCenter={25} size={26} tracking={0.14} caps color="#3C3C3C">NOME DO APRESENTADOR</Txt>
          </div>
        ) : null}
        {arcOp > 0 ? (
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <path d={camOutline(w, h, radius, 1.5, 0.62)} pathLength={100} fill="none" stroke={C.accent} strokeWidth={3 + swell}
              strokeLinecap="round" strokeDasharray={`${seg} ${100 - seg}`} opacity={arcOp} />
          </svg>
        ) : null}
      </div>
      {tagOp > 0 ? (
        <Txt x={Z.nameTag.x} capCenter={(Z.nameTag.y0 + Z.nameTag.y1) / 2} size={26} tracking={0.14} caps
          color={inkAt(r.look, Z.nameTag.y0).nameTag} opacity={tagOp}>NOME DO APRESENTADOR</Txt>
      ) : null}
    </>
  );
};
