// Z1 / Z1b: kicker row with the prop token, hook headline, HUD tag, readouts (Countdown, Tally), rail, and the
// closing headline (EndQuestion A / B, swapTo). SYSTEM 4, 7, 9, 10. ENGINE-OWNED.
import React, { useMemo } from "react";
import { capHeight, Txt, textWidth } from "../fonts";
import { inkAt, type Ink } from "../look";
import type { Resolved, ResolvedReadout, ResolvedWordSync } from "../resolve";
import { stageAt } from "../timeline";
import { bump, bumps, C_DEFAULT, clamp01, CLOSING_T, H, lerp, OUT, pop, prog, W, Z } from "../tokens";

const FULL: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: W, height: H };
import { HeadlineView, layoutHeadline, type HeadInk, type HLayout } from "./Headline";

// ---- looks: inks and the hook headline's place -------------------------------------------------------------------
/** Room (em) kept on each side of an accent phrase that is drawn on a tab. */
const TAB_PAD = 0.16;
const tabPadOf = (ink: Ink) => (ink.head.mode === "tab" ? TAB_PAD : 0);
const headInk = (ink: Ink): HeadInk => ({ text: ink.text, quote: ink.quote, accent: ink.head });
/** Ink of the HUD row / closing headline (top of the frame). */
const topInk = (r: Resolved) => inkAt(r.look, Z.headline.capTop);
/** The hook headline of the look: layout (auto-fit), left x, cap-top of line 0, baseline of the last line and its
 *  ink. Default look: x 60, cap-top 356, white. `look.layout.headline.bottom` anchors the LAST line's baseline
 *  instead. Needs the fonts (call it from components only). */
export const hookHead = (r: Resolved): { layout: HLayout; x: number; capTop: number; bottom: number; ink: Ink } => {
  const h = r.sb.hook;
  const hl = r.look.layout.headline;
  const ink = inkAt(r.look, hl.bottom ?? hl.capTop);
  const layout = layoutHeadline(h.lines, h.accent, h.quoted, h.size, hl.maxWidth, true, tabPadOf(ink));
  const tall = (layout.lines.length - 1) * layout.pitch + capHeight(layout.size);
  const capTop = hl.bottom === null ? hl.capTop : hl.bottom - tall;
  return { layout, x: hl.x, capTop, bottom: capTop + tall, ink };
};
/** Series badge of the kicker row ("CASO 01"): accent tab, graphite text. */
const BADGE = { h: 46, pad: 16, size: 28, tracking: 0.08, radius: 10, gap: 18 };
export const badgeWidth = (text: string) => textWidth(text, { size: BADGE.size, tracking: BADGE.tracking, caps: true }) + 2 * BADGE.pad;

/** [leva 6] HUD tag x: 124 beside the prop token, 60 when the look has no token. */
const tagXOf = (r: Resolved): number => (r.look.layout.clean ? Z.left : Z.tagX);
/** [leva 6] looks with layout.clean draw no kicker row (token, badge, kicker text). */
export const KickerRow: React.FC<{ r: Resolved; frame: number }> = (p) =>
  (p.r.look.layout.clean ? null : <KickerRowFull {...p} />);

// ---- kicker row + token ----------------------------------------------------------------------------------------
/** 0 = hook/closing size (84 px), 1 = HUD size (48 px). */
export const tokenShrink = (r: Resolved, frame: number) =>
  frame < r.P ? prog(frame, r.H, 14, OUT) : 1 - prog(frame, r.P, 14, OUT);

const KickerRowFull: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const h = r.sb.hook;
  const home = h.tokenHome;
  const head = useMemo(() => (home ? hookHead(r) : null), [r, home]);
  const layout = head ? head.layout : null;
  const k = tokenShrink(r, frame);
  let size = lerp(Z.token.hook.size, Z.token.hud.size, k);
  let x: number = Z.token.hook.x;
  let y = lerp(Z.token.hook.y, Z.token.hud.y, k);
  const from = r.hook.tokenFrom;
  const tokenOn = from === null || frame >= from;
  const tokenScale = from === null ? 1 : pop(frame - from);
  // kicker x: 164 beside the token, 60 without one
  let kx: number = from === null ? Z.kickerX : lerp(Z.kickerXNoToken, Z.kickerX, prog(frame, from, 8, OUT));
  if (home && layout && frame < r.P) {
    // c2: the token lives at the end of a headline line during the hook, then flies to the HUD (14 f, OUT)
    const ln = layout.lines[Math.min(home.line, layout.lines.length - 1)];
    const hs = home.size ?? 132;
    const hx = (head ? head.x : Z.left) + ln.width + (home.gap ?? 32);
    const hy = (head ? head.capTop : Z.headline.capTop) + home.line * layout.pitch + capHeight(layout.size) / 2 - hs / 2;
    const m = prog(frame, r.H, 14, OUT);
    size = lerp(hs, Z.token.hud.size, m);
    x = lerp(hx, Z.token.hud.x, m);
    y = lerp(hy, Z.token.hud.y, m);
    kx = Z.kickerXNoToken;
  }
  // out over the 3 frames BEFORE the hook exit: the collapsing headline travels through this row from H on and
  // must not cross live text (it cannot start later: the stage's top edge would wipe it)
  const kOp = frame < r.P ? 1 - prog(frame, r.H - 3, 3) : prog(frame, r.P + 8, 8);
  const Prop = r.module.Prop;
  // [looks] the token is drawn in the ink of the surface it sits on; the kicker row may start with the series badge
  // (an ink without token colours leaves the Prop its own defaults, which read the live on-film palette: when a
  // look overrides that palette the page token is pinned to the default white / accent instead)
  const tok = inkAt(r.look, y + size / 2).token ?? (r.look.film ? { color: C_DEFAULT.white, accent: C_DEFAULT.accent } : undefined);
  const ink = topInk(r);
  const badge = r.look.layout.badge ? r.badge : null;
  const bw = badge ? badgeWidth(badge) : 0;
  return (
    <>
      {tokenOn ? (
        <div style={{ position: "absolute", left: x, top: y, width: size, height: size, transform: `scale(${tokenScale})` }}>
          <Prop size={size} placement="token" frame={frame} moves={r.tokenMoves} appear={from ?? undefined}
            color={tok ? tok.color : undefined} accent={tok ? tok.accent : undefined} />
        </div>
      ) : null}
      {badge && kOp > 0 ? (
        <div style={{
          position: "absolute", left: kx, top: Z.kickerCy - BADGE.h / 2, width: bw, height: BADGE.h, borderRadius: BADGE.radius,
          background: r.look.badge.fill, opacity: kOp,
        }}>
          <Txt x={BADGE.pad} capCenter={BADGE.h / 2} size={BADGE.size} tracking={BADGE.tracking} caps color={r.look.badge.text}>{badge}</Txt>
        </div>
      ) : null}
      {kOp > 0 ? (
        <Txt x={badge ? kx + bw + BADGE.gap : kx} capCenter={Z.kickerCy} size={28} tracking={0.16} caps color={ink.text2} opacity={kOp}>{h.kicker}</Txt>
      ) : null}
    </>
  );
};

/** Headlines are only painted ABOVE the stage's top edge (8 px clear), so while the edge travels (hook exit,
 *  closing B) the type is wiped by the edge instead of sitting on the film (SYSTEM 0.5). */
const AboveStage: React.FC<{ r: Resolved; frame: number; clip?: boolean; children: React.ReactNode }> = ({ r, frame, clip = true, children }) => (
  // [looks] `clip` false: the look puts the hook headline somewhere else (over the picture, under the camera block)
  <div style={clip ? { ...FULL, clipPath: `inset(0px 0px ${H - (stageAt(r, frame).top - 8)}px 0px)` } : FULL}>{children}</div>
);

// ---- hook headline ---------------------------------------------------------------------------------------------
const punchScale = (frame: number, sync: ResolvedWordSync[], i: number, j: number, onlyPunch: boolean) => {
  let m = 0;
  for (const s of sync) {
    if (s.line === i && s.word === j && (!onlyPunch || s.punch)) m = Math.max(m, bump(frame, s.f, 6));
  }
  return 1 + 0.07 * m;
};
const slam = (frame: number, start: number) => {
  const p = prog(frame, start, 5, OUT);
  return { y: 40 * (1 - p), opacity: p };
};

export const HookHeadline: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const head = useMemo(() => hookHead(r), [r]);
  const { layout } = head;
  if (frame >= r.H + 8) return null;
  const c = prog(frame, r.H, 14, OUT);
  // Frame 0 is the poster / first paint of a Reel: the WHOLE question is on it, in place and at full opacity
  // (review: frame 0 used to show line 1 only). The entrance is a settle of the block, x 0.94 -> 1 over 8 f (it
  // grows into place, so nothing ever passes x 960), and the accent words punch when the sweep reaches them.
  const settle = lerp(0.94, 1, prog(frame, 0, 8, OUT));
  const accentPunch = 1 + 0.07 * bump(frame, r.hook.accentAt + 2, 8);
  const blockTransform = c > 0
    ? `translate(${(tagXOf(r) - head.x) * c}px, ${(248 - head.capTop) * c}px) scale(${1 - 0.7 * c})`
    : settle < 1 ? `scale(${settle})` : undefined;
  return (
    <AboveStage r={r} frame={frame} clip={r.look.layout.headline.clip}>
    <HeadlineView
      layout={layout}
      x={head.x}
      capTop={head.capTop}
      ink={headInk(head.ink)}
      word={(i, j) => ({
        scale: Math.max(punchScale(frame, r.hook.wordSync, i, j, false), layout.lines[i].words[j].accent ? accentPunch : 1),
      })}
      sweep={prog(frame, r.hook.accentAt, 8)}
      blockTransform={blockTransform}
      blockOpacity={1 - prog(frame, r.H, 8)}
    />
    </AboveStage>
  );
};

// ---- closing headline (EndQuestion) ----------------------------------------------------------------------------
/** Entry frame of every word of the end question (variant A): its wordSync frame, or the frame of the previous
 *  synced word in reading order (leading words: the first synced frame; no wordSync at all: P + 16). */
const entryFrames = (layout: HLayout, sync: ResolvedWordSync[], fallback: number): number[][] => {
  const enter = sync.filter((s) => !s.punch);
  const first = enter.length ? Math.min(...enter.map((s) => s.f)) : fallback;
  let last = first;
  return layout.lines.map((ln, i) => ln.words.map((_, j) => {
    const s = enter.find((e) => e.line === i && e.word === j);
    if (s) last = s.f;
    return s ? s.f : last;
  }));
};

export const ClosingHeadline: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const cl = r.sb.closing;
  const ink = topInk(r);
  const pad = tabPadOf(ink);
  const hink = headInk(ink);
  const layout = useMemo(() => layoutHeadline(cl.lines, cl.accent, !!cl.quoted, cl.size, Z.headline.maxWidth, true, pad), [cl, pad]);
  const swap = useMemo(() => (cl.swapTo
    ? layoutHeadline(cl.swapTo.lines, cl.swapTo.accent, !!cl.swapTo.quoted, cl.swapTo.size, Z.headline.maxWidth, true, pad) : null), [cl, pad]);
  const entries = useMemo(() => entryFrames(layout, r.closingSync, r.P + 16), [layout, r]);
  const Cf = frame - r.T;
  if (frame < (r.variant === "A" ? r.P : r.T)) return null;
  const exitLine = (i: number) => {
    if (!swap) return { y: 0, opacity: 1 };
    // all quote lines leave together over C 2..8, BEFORE the swapped-in question slams (C 10 / 13 / 16): the old
    // staggered exit (C 4..16) was still on screen under the new lines
    const p = prog(Cf, 2, 6);
    return { y: -30 * p, opacity: 1 - p };
  };
  let main: React.ReactNode;
  if (r.variant === "A") {
    let sweepAt = -1;
    layout.lines.forEach((ln, i) => ln.words.forEach((w, j) => {
      if (w.accent) sweepAt = Math.max(sweepAt, entries[i][j]);
    }));
    main = (
      <HeadlineView
        layout={layout}
        ink={hink}
        line={exitLine}
        word={(i, j) => {
          const p = prog(frame, entries[i][j], 5, OUT);
          return { y: 24 * (1 - p), opacity: p, scale: punchScale(frame, r.closingSync, i, j, true) };
        }}
        sweep={sweepAt < 0 ? 0 : prog(frame, sweepAt, 8)}
      />
    );
  } else {
    main = (
      <HeadlineView
        layout={layout}
        ink={hink}
        line={(i) => {
          // each line slams once the stage's top edge has passed it (the edge travels C 0..16)
          const a = slam(frame, r.T + CLOSING_T.slamB + CLOSING_T.slamStep * i);
          const e = exitLine(i);
          return { y: a.y + e.y, opacity: a.opacity * e.opacity };
        }}
        sweep={prog(frame, r.T + CLOSING_T.slamB + CLOSING_T.slamStep * layout.lines.length + 2, 8)}
      />
    );
  }
  return (
    <AboveStage r={r} frame={frame}>
      {!swap || Cf < 8 ? main : null}
      {swap && Cf >= 10 ? <HeadlineView layout={swap} ink={hink} line={(i) => slam(Cf, 10 + 3 * i)} sweep={1} /> : null}
    </AboveStage>
  );
};

// ---- HUD tag ---------------------------------------------------------------------------------------------------
// out in 6 f at P: the kicker row returns to the same place from P + 8
const hudOpacity = (r: Resolved, frame: number) => Math.min(prog(frame, r.H + 6, 8), 1 - prog(frame, r.P, 6));

/** HUD type sizes (review: 30 / 26 px read as 10 pt on a phone). The tag is fitted to the room left of the
 *  readout (x 124..620 when the storyboard has readouts, else x 124..960). */
const TAG = { size: 36, floor: 26, tracking: 0.12, pitch: 42 };
export const HudTag: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const { tag, sub } = r.sb.hud;
  const size = useMemo(() => {
    const room = (r.sb.hud.readouts.length ? 620 : Z.safeRight) - tagXOf(r);
    const widest = Math.max(1, ...tag.slice(0, 2).map((t) => textWidth(t, { size: TAG.size, tracking: TAG.tracking, caps: true })));
    return Math.max(TAG.floor, Math.min(TAG.size, Math.floor((TAG.size * room) / widest)));
  }, [r, tag]);
  const op = hudOpacity(r, frame);
  if (op <= 0) return null;
  const dx = -12 * (1 - prog(frame, r.H + 6, 8, OUT));
  const sc = 1 + 0.08 * bumps(frame, r.hudPulses, 6);
  const subOp = sub && r.hudSubAt !== null ? prog(frame, r.hudSubAt, 6) : 0;
  const two = tag.length > 1;
  const ink = topInk(r);
  return (
    <div style={{ ...FULL, opacity: op, transform: `translateX(${dx}px) scale(${sc})`, transformOrigin: `${tagXOf(r)}px 281px` }}>
      {tag.slice(0, 2).map((t, i) => (
        <Txt key={i} x={tagXOf(r)} capCenter={(two ? 260 : 262) + TAG.pitch * i} size={size} tracking={TAG.tracking} caps color={ink.text}>{t}</Txt>
      ))}
      {sub && tag.length === 1 && subOp > 0 ? (
        <Txt x={tagXOf(r)} capCenter={306} size={28} weight={400} color={ink.text2} opacity={subOp}>{sub.text}</Txt>
      ) : null}
    </div>
  );
};

// ---- readouts --------------------------------------------------------------------------------------------------
const RIGHT = Z.safeRight; // 960
const Label: React.FC<{ text: string; opacity: number; ink: Ink }> = ({ text, opacity, ink }) => (
  <Txt right={RIGHT} capCenter={250} size={28} tracking={0.16} caps color={ink.text2} opacity={opacity}>{text}</Txt>
);
/** m:ss,d with a pt-BR comma; `tenths` = whole tenths of a second. */
export const formatCountdown = (tenths: number) => {
  const t = Math.max(0, Math.floor(tenths));
  const ss = Math.floor(t / 10) % 60;
  return `${Math.floor(t / 600)}:${ss < 10 ? "0" : ""}${ss},${t % 10}`;
};
const Digits: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  let x = RIGHT;
  const cells: React.ReactNode[] = [];
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    const w = ch === ":" || ch === "," ? 20 : 40;
    // a digit that follows the decimal comma is LEFT-aligned in its cell: centred, a narrow "1" left a wide gap
    // after the comma ("0:06, 1")
    const afterComma = i > 0 && text[i - 1] === ",";
    cells.push(afterComma
      ? <Txt key={i} x={x - w + 1} capCenter={300} size={64} color={color}>{ch}</Txt>
      : <Txt key={i} cx={x - w / 2} capCenter={300} size={64} color={color}>{ch}</Txt>);
    x -= w;
  }
  return <>{cells}</>;
};

const Countdown: React.FC<{ ro: Extract<ResolvedReadout, { type: "countdown" }>; frame: number; ink: Ink }> = ({ ro, frame, ink }) => {
  if (frame < ro.arm || frame >= ro.clear + 8) return null;
  const out = 1 - prog(frame, ro.clear, 8);
  const inP = frame === ro.arm && ro.arm === 0 ? 1 : pop(frame - ro.arm + 1);
  const inOp = ro.arm === 0 ? 1 : clamp01((frame - ro.arm + 1) / 4);
  const left = ro.target - frame;
  const zero = prog(frame, ro.target, 6, OUT);
  const pulse = 1 + 0.06 * bumps(frame, [ro.target - 90, ro.target - 60, ro.target - 30], 6);
  const zp = pop(frame - ro.target);
  const tagW = textWidth(ro.zeroTag, { size: 42, tracking: 0.12, caps: true });
  return (
    <div style={{ ...FULL, opacity: out * inOp, transform: `scale(${lerp(0.9, 1, inP)})`, transformOrigin: `${RIGHT}px 284px` }}>
      {zero < 1 ? (
        <>
          <Label text={ro.label} opacity={1 - zero} ink={ink} />
          {/* the digits leave upwards by 20 px only: a full 64 px roll crossed the label above them */}
          <div style={{ ...FULL, opacity: (1 - zero) * (1 - zero), transform: `translateY(${-20 * zero}px) scale(${pulse})`, transformOrigin: `${RIGHT}px 300px` }}>
            <Digits text={formatCountdown(left / 3)} color={left <= 90 ? ink.digits : ink.text} />
          </div>
        </>
      ) : null}
      {frame >= ro.target ? (
        <div style={{ ...FULL, opacity: clamp01((frame - ro.target) / 4), transform: `scale(${lerp(0.8, 1, zp)})`, transformOrigin: `${RIGHT}px 300px` }}>
          <div style={{ position: "absolute", left: RIGHT - tagW - 14 - 16, top: 293, width: 14, height: 14, borderRadius: 7, background: ink.mark }} />
          <Txt right={RIGHT} capCenter={300} size={42} tracking={0.12} caps color={ink.text}>{ro.zeroTag}</Txt>
        </div>
      ) : null}
    </div>
  );
};

const Tally: React.FC<{ ro: Extract<ResolvedReadout, { type: "tally" }>; frame: number; ink: Ink }> = ({ ro, frame, ink }) => {
  if (frame < ro.arm || frame >= ro.clear + 8) return null;
  const out = 1 - prog(frame, ro.clear, 8);
  let n = 0;
  let last = ro.arm;
  ro.items.forEach((f) => {
    if (f <= frame) {
      n++;
      last = f;
    }
  });
  const roll = n > 1 ? prog(frame, last, 6, OUT) : 1;
  const inP = pop(frame - ro.arm + 1);
  return (
    <div style={{ ...FULL, opacity: out * clamp01((frame - ro.arm + 1) / 4), transform: `scale(${lerp(0.9, 1, inP)})`, transformOrigin: `${RIGHT}px 284px` }}>
      <Label text={ro.label} opacity={1} ink={ink} />
      <div style={{ position: "absolute", left: RIGHT - 120, top: 268, width: 120, height: 64, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -(RIGHT - 120), top: -268, width: W, height: H }}>
          {roll < 1 ? (
            <div style={{ ...FULL, transform: `translateY(${-64 * roll}px)` }}>
              <Digits text={String(n - 1)} color={ink.text} />
            </div>
          ) : null}
          <div style={{ ...FULL, transform: `translateY(${64 * (1 - roll)}px)` }}>
            <Digits text={String(n)} color={ink.text} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const Readouts: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const ink = topInk(r);
  return (
    <>
      {r.readouts.map((ro, i) => (ro.type === "countdown"
        ? <Countdown key={i} ro={ro} frame={frame} ink={ink} />
        : <Tally key={i} ro={ro} frame={frame} ink={ink} />))}
    </>
  );
};

// ---- rail ------------------------------------------------------------------------------------------------------
export const Rail: React.FC<{ r: Resolved; frame: number }> = ({ r, frame }) => {
  const draw = prog(frame, r.H + 10, 10, OUT);
  const op = 1 - prog(frame, r.P, 8);
  if (draw <= 0 || op <= 0) return null;
  const x0 = Z.stage.x0;
  const w = Z.stage.w;
  const fill = (w * Math.min(frame, r.T)) / r.T;
  const ink = topInk(r);
  return (
    <div style={{ ...FULL, opacity: op }}>
      <div style={{ position: "absolute", left: x0, top: Z.railY - 0.5, width: w * draw, height: 1, background: ink.line }} />
      <div style={{ position: "absolute", left: x0, top: Z.railY - 1, width: Math.min(fill, w * draw), height: 2, overflow: "hidden" }}>
        <div style={{ width: w, height: 2, background: ink.railFill }} />
      </div>
      {r.readouts.map((ro, i) => {
        if (ro.type !== "countdown") return null;
        const x = x0 + (w * ro.target) / r.T;
        return x <= x0 + w * draw
          ? <div key={i} style={{ position: "absolute", left: x - 0.5, top: Z.railY - 4, width: 1, height: 8, background: ink.text2 }} />
          : null;
      })}
    </div>
  );
};
