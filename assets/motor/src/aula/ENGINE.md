# Aula engine — contract for element, cut and ALT authors

Implements `spec/SYSTEM.md` sections 1-7 and 9-12 as ONE generic composition, `AulaCut`, driven by a storyboard
JSON. Read `spec/SYSTEM.md` first; this file only says how the code is laid out and what you may rely on.
Looks (the same cut in another colour theme / layout, ids `rp-cN-<look>`): section 14.

Windows notes: shell = Git Bash, Python = `py -3.12`, quote the project path (it has spaces). Do not paste
multi-line code with single quotes into a bash heredoc (it breaks); write files with your file tool.

## 1. File map and ownership

| Path | Owner | What |
|---|---|---|
| `scripts/prep_media.py` | engine | slide/cam proxies, mastered audio, sfx (already run for c1..c6) |
| `scripts/stills.mjs`, `scripts/sheet.py` | engine | stills with a 3-slot semaphore, contact sheets |
| `src/Root.tsx` | engine | registers `rp-c1..rp-c6`, `rp-lab-a`, `rp-lab-b` + whatever `alt/register.tsx` exports |
| `src/aula/*.ts(x)`, `components/*` | engine | tokens, fonts, anchors, camera, timeline, resolve, stage, HUD, captions, bubble, closing, sound |
| `src/aula/elements/types.ts`, `context.ts`, `api.ts`, `registry.ts`, `Debug.tsx` | engine | the element contract (do not edit) |
| `src/aula/elements/screen/*` | **screen-group author** | Chip, CountTick, EquationBar, PropCard, Prop, AnswerField (+ `index.ts`) |
| `src/aula/elements/slide/*` | **slide-group author** | Ring, Brackets, Trace, Guide, CursorHalo, ScanLine, Spotlight, Compare (+ `index.ts`) |
| `src/aula/cuts/c<N>.tsx` | **cut author of c<N>** | the cut's `Prop` component + its `elements` map |
| `src/aula/cuts/index.ts` | engine | `prop.component` name -> cut module (CoinProp, BombomProp, TracheaPush, LaudoSheet, RibArc, SkinFold) |
| `src/storyboards/c<N>.json` | **cut author of c<N>** | the storyboard (c1, c5, c6: everything except beats is transcribed; c2-c4 too, as a starting point; ALL have `beats: []`) |
| `src/storyboards/lab-a.json` | **screen-group author** (test bench, comp `rp-lab-a`) | copy of c5 with three `Debug` beats |
| `src/storyboards/lab-b.json` | **slide-group author** (test bench, comp `rp-lab-b`) | copy of c5, no beats |
| `src/aula/alt/*` | **ALT author** | `register.tsx` exports `ALT_COMPOSITIONS` (empty stub) |
| `src/data/*` | read-only | `c<N>.json` (palavras), `cursor-c<N>.json`, `face.json` (copied from `spec/data`) |
| `public/<id>/slide.mp4, cam.mp4, audio.wav`, `public/sfx/*.wav` | generated | never edit by hand; re-run `prep_media.py` |

The two element groups never need a shared file: `registry.ts` imports `screen/index.ts` and `slide/index.ts`;
each group edits only the files in its own folder (the stub file names and the exported names are final).

Media proxies (all 30 fps, same frame count as `video.mp4`, `-g 10`, no B-frames, crf 12, no audio):
- `slide.mp4` = source crop x 6, y 84, 1368x912 (one extra column on the LEFT because yuv420p needs an even width).
  Slide-space x = proxy x - 1; `FilmView` places the video at left -1 inside the 1367x912 slide box, so slide
  space is exactly SYSTEM 3.1. Tokens: `SLIDE_PROXY`.
- `cam.mp4` = source crop x 1502, y 389, 418x302 (one extra column on the left; tile-local x = proxy x - 1).
  Tokens: `CAM_PROXY`. Only `FaceCrop` reads it.
- `audio.wav` = 48 kHz stereo, two-pass loudnorm I -14 / TP -1.5 / LRA 11, pass 2 with the measured values and
  `linear=true`. Two additions were needed to really land on target: (1) the sources peak at about -0.5 dBTP, so
  the linear gain would break the true-peak ceiling and loudnorm silently falls back to dynamic mode; a
  look-ahead limiter shaves the top speech peaks before both passes (closed loop); (2) loudnorm's own meter
  under-reads short files (c5: -14.0 where ffmpeg's `ebur128` filter and an independent BS.1770-4 calculation
  both read -13.5), so the result gets a final linear trim and is verified with `ebur128`. Final (ebur128):
  every cut I = -14.0 LUFS; TP c1 -1.9, c2 -1.6, c3 -2.1, c4 -1.7, c5 -2.2, c6 -2.0 dBTP.
- `public/sfx`: tick and pop exactly as SYSTEM 11 (lavfi's `sine` has amplitude 1/8, so they peak at about
  -43 / -41 dBFS: very subtle). whoosh uses `bandpass=f=900:width_type=h:w=600`: the recipe as written
  (`w=600` = Q 600) yields digital silence (-75 dBFS peak); with the 600 Hz band it peaks at -42 dBFS.

## 2. How a storyboard is resolved

`resolveStoryboard(sb)` (`resolve.ts`, memoised per storyboard object; also called by `calculateMetadata`, so a bad
storyboard fails before the first frame) produces a `Resolved`:

1. `data` (palavras, segmentos) from `sb.data`; `frames` must equal `data.frames`. `T = frames`,
   `total = T + 102`, `H = hook.exit`, `P = closing.preRoll` (variant A) or `T` (variant B).
2. **Anchors**: `{w,n,off?,f}` -> index of the n-th `palavras` entry whose `w` is EXACTLY `w` ->
   `round(s*30) + off`; throws if `|resolved - f| > 1` (message names the storyboard path). `{f}` = absolute frame.
   Every anchor-shaped object anywhere inside `beat.props` is validated too (`validateAnchorsDeep`).
3. **Joins** = `round(segmentos[i].out_start*30)`, i > 0. JoinBlink, bubble re-pop and a -6 dB whoosh are automatic.
4. **Camera** (`timeline.ts`): `camera[]` sorted by frame; the first keyframe MUST be at `H` (hook exit). A key
   with `cut: true` or sitting on a join is a hard cut. `punch: true` keys (no `to`) multiply s by 1.045 (6 f in,
   20 f back). A key at `P` to `closing.slotCam` (16 f) is added if the storyboard has none. Between keys the
   scale drifts x(1 + 0.005/s); during C 48..102 it drifts x1.03. Keys AFTER `T` are allowed (see section 9,
   "closing end camera"). Any `s > 2.0` throws. Before `H` the stage uses `hook.slot.cam[0] -> [1]`.
5. **Stage rect** (`stageAt`): top 716 until H, 716 -> 360 over H..H+16 (OUT), 360 -> 716 over P..P+16 (INOUT);
   bottom 1210 -> 1052 over T+10..T+26 (INOUT). `stageCy` is always the current rect's centre.
6. **Beats**: `el` looked up in `REGISTRY`, then in the cut module's `elements`; unknown names throw. `until`:
   an Anchor -> that frame; `"closing"` -> `P`; `"end"` -> `T`; omitted -> the element's `defaultUntil`
   (default `"closing"`). A beat whose id is in `closing.keep` and whose until is `"closing"`/`"end"`/default never
   exits. A beat with an explicit Anchor `until` exits there even when kept. Every beat is unmounted 6 frames
   after its `until` (the engine fades it unless the element sets `ownExit`).
7. **Readouts**: countdown `clear` defaults to the next readout's arm, else `P`. A countdown longer than 12 s throws.
8. **Sound cues**: collected and thinned (section 8).

Engine extensions to the SYSTEM 12 schema (all optional, typed in `types.ts`, marked `[ext]`):
`covers[].id`, `covers[].pulses`, `hook.slot.ease` ("linear" | "out" | "inout", c4 reverse dolly = "out"),
`hook.tokenHome` (c2: token parked after a headline line until H), `hud.pulses`, `camera[].ease`
("inout" | "linear" | "out"; c3/c4 slow pushes), `camera[].to` optional on punch keys, `beats[].pane`,
`wordSync[].punch` (word only punches on that frame; c6 "pensar" #1), `closing.swapTo.quoted`,
`tokenMoves[] {at, name, dur?, args?}`, `stageFx[] {type:"tilt", at}` (c4), `sounds[] {at, cue, gainDb?}`.
`storyboard.id` is a free string (labs); `sb.data`'s stem selects `face.json`.

## 3. Layers and z-order (bottom to top)

```
Background (gradient + drifting radial light)
Stage  = ClipBox (radius 28, graphite2, 1 px line, overflow hidden; children in CANVAS px)
  1 FilmView            slide.mp4 through the camera, clip-path = union of films[] active on the footage frame
  2 patches             slide-space rects (stage notch / filmBlack)
  3 covers              opaque cards (lock glyph until the label)
  4 elements' Under     screen-space HTML below the marks (Compare's second film layer)
  5 elements' Slide     ONE canvas-sized <svg>, <g transform = camera>: slide-space SVG marks, in beat order
  6 cover label chips
  7 elements' Screen    screen-space HTML (chips, numerals, cards, props), in beat order
  8 elements' Over      screen-space HTML above every Screen layer (ScanLine, Spotlight)
  9 JoinBlink
(hook with panes: one ClipBox per pane with its own FilmView + the layers of the beats that set "pane": N)
Rail, kicker row + token, HUD tag, readouts, hook headline, closing headline
CTA line
Face bubble + name tag, captions, lockup
```
Beats are drawn in array order inside each layer (later = on top). Everything inside the stage is clipped by it.

## 4. Writing an element

An element is a plain object made with `defineElement<Props>({...})` and exported under its `el` name. The engine
mounts it from `at - lead` to `until + 6` and calls each layer with the same `ctx` (`ElCtx<Props>`, see
`elements/types.ts`). Import everything from `../api` (inside `elements/screen|slide`) or `../elements/api`
(inside `cuts/`). Reference implementation: `elements/Debug.tsx`. Example:

```tsx
import { defineElement, frames, type Anchor, type Pt } from "../api";

export interface RingProps { c: Pt; rx: number; ry?: number; draw?: number; pulses?: Anchor[] }

export const Ring = defineElement<RingProps>({
  defaultUntil: "closing",                       // used when the beat has no "until"
  cues: (beat) => [{ f: beat.at, cue: "tick" }], // optional sound request (pure; thinned by the engine)
  Slide: ({ ctx }) => {                          // SVG nodes in SLIDE px, already inside the camera transform
    const { props, frame, at, ease, tokens: { C, dim } } = ctx;
    const [cx, cy] = props.c, rx = props.rx, ry = props.ry ?? props.rx;
    const drawn = ease.prog(frame, at, props.draw ?? 10, ease.OUT);
    const pulse = 1 + 0.12 * ease.bumps(frame, frames(ctx, props.pulses), 8);
    // clockwise from 12 o'clock; pathLength = 1 makes the dash maths independent of the real length
    const d = `M ${cx} ${cy - ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy + ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy - ry}`;
    const common = { d, pathLength: 1, fill: "none", strokeDasharray: 1, strokeDashoffset: 1 - drawn, strokeLinecap: "round" as const };
    return (
      <g transform={`translate(${cx} ${cy}) scale(${pulse}) translate(${-cx} ${-cy})`}>
        <path {...common} stroke={dim(0.5)} strokeWidth={ctx.px(5)} />   {/* ctx.px(n) = n SCREEN px in slide units */}
        <path {...common} stroke={C.accent} strokeWidth={ctx.px(3)} />
      </g>
    );
  },
  Screen: ({ ctx }) => {                         // HTML in CANVAS px; clipped by the stage
    const [x, y] = ctx.toScreen(ctx.props.c);
    return <div style={{ position: "absolute", left: x - 3, top: y - 3, width: 6, height: 6, borderRadius: 3, background: "#FFFFFF" }} />;
  },
});
```

`ctx` gives you:
- time: `frame`, `at`, `until`, `age` (= frame - at), `exit` (0 -> 1 over the 6 frames after `until`), `opacity`
  (= 1 - exit; already applied to your layers unless `ownExit: true`), `videoFrame` (footage frame shown by the
  stage: `min(frame, freezeStageAt, T-1)`; use it for anything glued to the picture, e.g. the cursor in c3's
  frozen ending and in every closing);
- closing: `closing.{variant, P, T, C, active, kept, dim}` (`kept` = this beat is in `closing.keep`; `dim` 0..1 =
  film dim progress, the film is at brightness `1 - 0.45*dim`);
- geometry: `stage` (CURRENT rect `{left,right,top,bottom,cx,cy,w,h}`; in a pane it is the pane rect), `view` /
  `cam {cx,cy,s}`, `toScreen(pt)`, `toSlide(pt)`, `rectToScreen(rect)`, `px(n)`, `dock(d)` -> `{x, y, align,
  bottom}` for `TL | TR | BL | BL2 | BR | {x,y}` (TL/BL: `x` = left edge 60; TR/BR: `x` = RIGHT edge 940; `y` =
  top of a 56 px chip; `bottom` = stageBottom - 16 for cards);
- data: `props`, `beat`, `cursor` (`raw(f)`, `visible(f)`, `hiddenRun(f)`, `smooth(f, window = 7, hold = 10)`,
  `path(f0, f1, avg = 5)`, `intervals`), `palavras`, `fr(anchor)` (frame with the +-1 assertion), `joins`, `sb`,
  `r` (everything resolved: `r.beats` lets you find siblings for row docks / "previous" CountTicks), `dir`,
  `pane`;
- look: `tokens` (`C`, `dim`, `FONT`, `STROKE`, `Z`, ...), `ease` (`OUT`, `INOUT`, `pop(framesSinceTrigger)`,
  `prog(frame, start, dur, ease?)`, `bump`, `bumps`, `lerp`, `clamp01`), `Prop` (the cut's prop component).

Helpers in `api.ts`: `Txt` (one absolutely positioned line of Manrope placed by `capTop` / `capCenter` /
`baseline` and `x` / `right` / `cx`), `textWidth(text, {size, tracking, caps, weight})`, `fitSize`, `capHeight`,
`catmullRomPath(points)`, `polylineLength`, `pointAlong`, `roundRectPath`, `rectCenter`, `FilmView` (a second
film layer: `<FilmView dir={ctx.dir} films={ctx.sb.films} view={viewFromCam(cam, {x,y,w,h})}
videoFrame={ctx.videoFrame} />`; it can only ever paint `films[]`), `viewFromCam`, `moveSpecs`, `activeMove`,
`PropSvg`, `frames(ctx, anchors)`.

Rules: fonts are only usable inside components rendered by `AulaCut` (it waits for Manrope with
`delayRender`); use `Txt`/`textWidth`, never raw font metrics. Colours only from `C` / `dim()`. No text shadows,
outlines or glows. Text must stay inside x <= 960, y 220..1500 (the stage itself runs to x 1040: keep chip text
left of 960, `dock("TR").x` is already 940). Never use `Math.random()` or state: a frame must be a pure
function of `ctx`.

Hook-pane beats (c1): add `"pane": 0` (or 1) to the beat. It is then drawn inside that pane (its `ctx.stage` /
`ctx.view` are the pane's) and is force-exited by H+10.

### Sound from an element
`cues: (beat, r) => [{ f, cue: "tick" | "pop" | "whoosh", gainDb? }]` on the def. It is evaluated once per cut
(not per frame), so compute frames from `beat.at` / `r.fr(anchor)`. See section 8 for the thinning rule.

### A cut-specific element
Put it in `src/aula/cuts/c<N>.tsx` and list it in the module's `elements` export; the storyboard then uses
its key as `el`. Nothing shared changes.

```tsx
import { defineElement, type ElementDef } from "../elements/api";
const Divider = defineElement<{ y: number; x0: number; x1: number; draw?: number }>({
  defaultUntil: "closing",
  Slide: ({ ctx }) => {
    const k = ctx.ease.prog(ctx.frame, ctx.at, ctx.props.draw ?? 14, ctx.ease.INOUT);
    const { x0, x1, y } = ctx.props;
    return <line x1={x0} y1={y} x2={x0 + (x1 - x0) * k} y2={y} stroke="rgba(255,255,255,0.3)" strokeWidth={ctx.px(1)} />;
  },
});
export const elements: Record<string, ElementDef<any>> = { Divider };
```

## 5. The Prop interface (`propTypes.ts`, helpers in `propKit.tsx`)

```ts
interface PropProps {
  size: number;                      // side of the square box in px (the token passes 84..48 while resizing)
  placement: "token" | "card" | "film";
  frame: number;                     // current composition frame
  moves: PropMove[];                 // { name, at (resolved frame), dur?, args? }, sorted by at
  appear?: number;                   // frame this instance appeared on (self-drawing intros)
  color?: string; accent?: string;   // defaults white / accent
}
export const Prop: PropComponent;    // src/aula/cuts/c<N>.tsx
export const elements: Record<string, ElementDef<any>>;
```
- The Prop only DRAWS inside its box (2 px white strokes, one accent detail, transparent fill) and interprets the
  move names of SYSTEM 8.22; unknown names must be ignored. It never positions itself and never pops itself.
- Hosts: **token** = the engine (kicker row 84 px at (60,240) <-> HUD 48 px at (60,236); moves =
  `hook.tokenMove` at `hook.accentAt`, `storyboard.tokenMoves[]`, `closing.propMove` at T+8); **card** = the
  `PropCard` element (`props.moves`); **film** = the `Prop` element (`props.moves`, `props.fly`).
- `PropSvg` gives a 0..1 viewBox and `sw(px)` for stroke widths; `activeMove(moves, frame, names?)` returns the
  latest started move and frames since it started.
- The current files are PLACEHOLDERS: a static drawing, and every move only plays a 10 % scale pulse.

## 6. What the engine draws by itself (do not re-implement)

Background; Stage with FilmClip, patches, covers (lock glyph, label chip, locked shake, glyph rock, dot pulses,
label kept via `closing.keep: ["<coverId>-label"]`, default ids `coverA`, `coverB`, ...); PaneSplit hook (panes
merge into the first body camera over H..H+16); `freezeStageAt`; JoinBlink; stage tilt; kicker row and token
(incl. `tokenFrom`, `tokenHome`); hook headline (auto-fit, slams at f 3/6, word punches, accent sweep, collapse);
HUD tag (+ sub line, pulses); Countdown (m:ss,d, refresh every 3 f, last-3-s accent + pulses + ticks, zero tag
with pop); Tally; Rail (+ target notches); face bubble (crop keys, speaking arc, unit pulse, join re-pop,
face-lost still, closing freeze, name tag); captions (units, fit, accent, emphasis, hide, pause fade, silence
dots); closing A/B (EndQuestion word by word / slams, `swapTo`, film dim, stage shrink, CTA line, lockup with
pill and logo, hold drift); one speech `<Audio>` + cue track.

Two deliberate details that go slightly beyond the letter of the spec:
- headlines are clipped to ABOVE the stage's top edge and the CTA to BELOW its bottom edge while those edges
  travel (the spec's timings overlap by a few frames; this keeps type off the film);
- ALL-CAPS headline word gaps are widened by 0.06 em (Manrope's narrow space + -0.02em tracking made words
  touch); the auto-fit accounts for it.

## 7. Countdown / anchors cheat-sheet for cut authors

- Storyboard anchors must match `palavras[].w` exactly (punctuation, capitalisation). The error message tells you
  the resolved frame.
- `beats[].props` may contain anchors anywhere; they are all checked.
- `captions.accent` / `captions.emphasis` must be word anchors (not `{f}`).
- `closing.keep` ids that match no beat / cover label only produce a console warning (once beats exist).

## 8. Sound

`resolve.ts` collects cue requests in this order: hook accent sweep (tick), stage open (whoosh at H+2), stage close
(whoosh at P+2), joins (whoosh -6 dB), countdown last 3 s (ticks) and zero (pop), closing prop callback (pop at
T+8), stage tilt (whoosh), cover shakes (tick), `storyboard.sounds[]`, then each beat's `def.cues()`. They are
sorted by frame (ties: the order above) and thinned greedily: a cue closer than 20 frames to the last ACCEPTED
one is dropped. `r.cues` / `r.cuesSkipped` hold the result (each with a `src` string). The cue wavs already
carry their level (-22 / -20 / -24 dB); `gainDb` is added on top. Only `sound.tsx` creates `<Audio>` tags.
Consequence of the rule in variant B closings (c3, c5): the stage-close whoosh (T+2) wins and the prop-callback pop
(T+8) is dropped. Verified on rp-c5 by subtracting the speech from an audio-only render: cues at f 10, 98, 455.

## 9. Things cut authors will want to know

- **Closing end camera.** After T+10 the stage bottom edge rises to 1052 and, as SYSTEM 3.1 says, the camera keeps
  its slide centre at the moving stage centre (884): the picture slides up by 79 px. With c1's SLOT-END camera
  this pushes object A / `ringA` (slide y 46) out of the top of the slot. Fix it per cut with an ordinary camera
  key after T, e.g. c1: `{ "at": {"f": 1275}, "to": {"cx":540,"cy":162,"s":0.94}, "dur": 16 }` (cy lowered by
  79 / s keeps the picture still while the edge crops it; already in the c1 stub). Check `closing.keep` marks of
  every cut on a still at T+60.
- c1 SLOT-END at s 0.94 shows slide y -17..509 in the 494 px slot, so the top 19 px of film B and of cover B peek
  in at the slot's bottom between P+16 and T+10. Use a slightly different slot camera if that bothers you.
- `hook.slot.cam` pair is interpolated over 0..H (`hook.slot.ease`), then the first camera key (at H) takes over.
- Beats before H are drawn in the slot (or in a pane with `"pane"`); docks follow the moving stage edges.
- `films[].from/to` are FOOTAGE frames (c3); the clip follows `videoFrame`, so the frozen ending keeps film B1.
- Storyboard JSON is imported statically (`src/aula/storyboards.ts`): a new storyboard file needs a line there
  (engine-owned; the eight existing ones are registered).

## 10. ALT: what you can reuse

`src/aula/alt/register.tsx` exports `ALT_COMPOSITIONS: { id, component, durationInFrames, defaultProps? }[]`
(1080x1920, 30 fps are fixed by Root). Expected ids: `rp-c4-alt`, `rp-c6-alt`. `AulaCut` has NO ALT branch:
build your own composition component in `alt/` from these pieces (import, do not copy):

| Need | Import |
|---|---|
| tokens, easings | `../tokens` (`C`, `dim`, `OUT`, `INOUT`, `pop`, `prog`, `bump`, `Z`, ...). The lightbox fill `#F4FCFE` is ALT-only: define it in your folder |
| fonts | `useFontsReady()` (render nothing until true), `Txt`, `textWidth`, `fitSize` from `../fonts` |
| data + anchors | `getCutData("c4.json")`, `getCursorData`, `getFaceData("c4")` from `../data`; `resolveAnchor(a, palavras, where)` from `../anchors` |
| camera maths | `viewFromCam(cam, {x,y,w,h})`, `makeView`, `lerpCam`, `numCam`, `toScreen`, `rectToScreen`, `viewCss`, `viewSvg` from `../camera` (pass the lightbox WINDOW rect: x 50, w 980, so the centre is 540) |
| FilmClip | `FilmView` from `../components/FilmView` (props `dir, films, view, videoFrame, brightness, filter, opacity`); wrap it in your own clipped window div whose inner layer is positioned at canvas (0,0); a Lupa is a second `FilmView` with a scaled view inside a circular clip |
| face bubble | `FaceCrop` (`d = 180`), `faceCx`, `speakingLevel` from `../components/FaceBubble` |
| cursor | `makeCursor(getCursorData(...))` from `../cursor` (`smooth(f, 9)`, `path(f0, f1)`) |
| audio | `<Audio src={staticFile("c4/audio.wav")} />`; cues with `scheduleCues` + `<CueTrack>` from `../sound` (relay click: synthesise your own wav into `public/sfx/`) |
| background | `Background` from `../AulaCut` (`light={false}` for the dark room) |
| caption units | `buildUnitGroups` is one-word mode only; phrase mode (ALT.md 4) is yours to write |

## 11. Running things

```bash
npm run typecheck
# stills (bundles once; 3-slot semaphore in out/.locks; safe to run from several agents at once)
node scripts/stills.mjs rp-c5 --frames 0,6,30,100-112:4,last --scale 0.5      # -> out/stills/rp-c5/f00030.png
node scripts/stills.mjs rp-lab-a --frames all:30                               # every 30th frame
# contact sheet (labels = frame + seconds; --safe draws the y 220 / y 1500 / x 960 guides)
py -3.12 scripts/sheet.py out/stills/rp-c5 -o out/sheets/rp-c5.png --cols 5 --width 380 --safe
py -3.12 scripts/sheet.py out/stills/rp-c1 --frames 0,104,890 -o out/sheets/c1-pick.png
# full render (remotion.config.ts caps the OffthreadVideo cache at 400 MB and concurrency at 4)
npx remotion render rp-c5 out/c5.mp4 --concurrency=4
# media (only if a source video changes)
py -3.12 scripts/prep_media.py c5 --force        # or: --only audio | slide | cam | sfx
```
`stills.mjs` always takes the composition id as its FIRST argument. It writes its bundle to
`out/.bundles/<pid>` with `public` as a directory junction (nothing is copied) and removes both on exit. A
storyboard error (bad anchor, unknown element) makes it fail with the message from `resolve.ts`.

## 12. NOT implemented / not verified (be aware)

- Every element in `elements/screen` and `elements/slide` is a stub that renders nothing (only `Debug` draws).
- The six Props are placeholders (static drawing + pulse on any move).
- No storyboard has beats yet (except the three `Debug` beats of `lab-a`).
- ALT format: nothing beyond the reusable pieces above (no lightbox, relay flicker, phrase captions, Lupa, ALT
  closing). The SYSTEM 5 phrase-mode caption fallback for c3/c6 is therefore not available either.
- Chip rows (`row: true` layout), Chip `protect` checks, CountTick "previous" state: left to the element authors
  (use `ctx.r.beats`).
- SYSTEM 13 items 1 (doctor's sign-off on anatomy marks) and 2 (listening to doubtful transcript words) cannot be done by code; they are still open.
- Not checked by the engine author: Remotion Studio preview (`npm run dev`), full-length full-resolution renders of
  c1-c4 and c6, the phone test, and whether the c3 slide change falls exactly on footage frame 231.

## 13. Review round 1: what changed in the engine (read this before touching a storyboard)

Everything below is ENGINE behaviour; no storyboard, cut module or ALT file was edited. Sections 1-12 above describe
the first version: where they disagree with this section, this section wins.

### 13.1 Word timing: audible onsets (`scripts/onsets.py` -> `src/data/onsets.json`, applied in `data.ts`)
The transcription puts the start of a word that follows a pause INSIDE the pause (c2 "Cadê" listed f 964, audible
f 977; c1 "metálico," 162 -> 186; c6 "Então," 213 -> 237). `getCutData()` now returns `palavras[i].s` = audible onset
and keeps the listed value in `s0`. An anchor `{w, n, f}` RESOLVES to the audible frame and its expected `f` is
accepted when it matches the listed OR the audible frame, so every storyboard still resolves, but beats, camera
keys, countdown targets and word-synced headline words on such words now happen 6-25 frames LATER than their `f`.
Absolute frames (`{ "f": N }`, `closing.preRoll`, `captions.hide`, `until: {f}`, CursorHalo `from`/`to`, `fly`
landing frames) do NOT move: re-check every absolute frame that was written next to a moved word
(`node scripts/dump.mjs c2 --cam` prints the resolved frames; c1 coin: at 186, `until {f: 234}`).

### 13.2 Camera block (client request) replaces the face bubble
`components/FaceBubble.tsx`: 230 x 230 px rounded rectangle (radius 28, 1 px line) at x 60, y 1238 (`Z.cam`). It shows
a 262 x 262 px window of the webcam tile that follows the head in x (`face-track.json`, `scripts/face_track.py`)
and in y: rows 4..266 while he sits upright, sliding down to rows 40..302 when he leans in (his mouth and chin are
below row 266 then). The burned-in "Nome do Apresentador" label is painted out by an opaque tab pinned to it whenever the
window reaches it. Speaking indicator = accent segment on the border (top-right), swelling on every caption unit;
re-pop (8 f) on joins and on face-lost switches; face-lost = hard switch to the still + slow push-in (no ghosted
cross-fade); closing freeze as before. Layout that moved with it: `Z.caption` x 316..956 (max width 640, centre
636), name tag at x 316, lockup x 316..956.
ALT: `<CamCrop dir face videoFrame w h radius zoom?>`, `camCx`, `camY0`, `speakingLevel` are exported for you; the
legacy circle `<FaceCrop>` is still there only so `alt/Bubble.tsx` keeps compiling.

### 13.3 Hook
- Frame 0 shows the WHOLE headline (all lines, final position). Entrance = block settle x 0.94 -> 1 (8 f); accent
  words punch on the sweep; word-sync punches unchanged (growth capped so words never touch).
- Slot camera: settle x 0.93 -> 1 over f 0-16, then a slow push to x 1.06 at H (`timeline.hookScaleMul`; PaneSplit
  panes too, about their pins; never above s 2.0). A slot camera that already travels > 15 % (c4) only gets the push.
- Automatic camera punch (x 1.06) on `hook.accentAt`; automatic filler ScanLine (30 f, opacity 0.6) at 58 % of the
  hook when no stage beat starts in f 40 .. H - 12 (beat id `auto-hook-scan`; c2, c3, c5 get one today).
  `"hook": { "autoMotion": false }` switches all three off.
- The kicker fades over H - 3 .. H (the collapsing headline no longer crosses it). The hook-exit camera key eases
  OUT like the stage edge unless the key has its own `ease` (PaneSplit hooks keep INOUT): no empty band above the film.

### 13.4 Body camera
- After a move settles the camera BREATHES: s x (1 + 0.08 (1 - cos) / 2), period 240 f (about 3 % per second at its
  fastest). A new key (even to the same target) restarts it. Keys at or after P keep the old 0.5 % per second.
- Automatic punches (x 1.045) on every `captions.accent` / `emphasis` word and countdown zero in H + 20 .. P - 30,
  unless a camera key is within 20 f, a join within 12 f or another punch within 45 f. `"autoPunch": false`
  (storyboard root) switches them off. `node scripts/dump.mjs --cam` lists them (suffix `a`).
- Closing hold push x 1.06 (was 1.03) over C 48..102: check that kept marks stay inside the slot.

### 13.5 Closing (timings in `tokens.CLOSING_T`)
Film dim 0.30 (was 0.45; `tokens.FILM_DIM`, `ctx.closing.filmDim`). Variant B lines slam at C 7 / 10 / 13 (after the
stage's top edge has passed them), sweep after the last line. `swapTo`: the quote leaves over C 2..8, the new lines
slam at C 10 / 13 / 16. CTA rows at C 22 / 25 (after the bottom edge has passed), sweep C 31; CTA type 72 px, pitch
78, cap-top 1078. Pill: 72 px high, 32 px GRAPHITE text on the accent gradient (7 : 1), grows C 40..50, lands with
a bump at C 51 and pulses again at C 76. HUD tag out in 6 f at P. With `swapTo` the CTA, the pill and their cues
are 4 f later.

### 13.6 Sound
`public/sfx` regenerated (`prep_media.py --only sfx --force`): tick -23, pop -21, whoosh -20 dBFS peak, i.e. 18-21 dB
under the speech peak (-2 dBFS). Do not add gain in `sound.tsx`. New engine cues: pop (-3 dB) on f 1 (hook
headline), tick on the CTA accent sweep, pop (-2 dB) when the pill lands, tick (-4 dB) on the pill pulse. On a
collision inside 20 f the priority is pop > whoosh > tick. Measured on an audio-only render of rp-c5 with the
speech subtracted: speech gain +0.000 dB, cues on their frames, I = -14.0 LUFS, TP -2.1 dBTP.

### 13.7 Captions (`captions.ts`, `components/Captions.tsx`)
Units never bridge punctuation or a pause longer than 6 f (a comma may sit inside a unit only when the words run
on; as a last resort for a unit shorter than 8 f the comma is bridged up to 6 f: "superior, né?"); a short word
that ends in punctuation joins the PREVIOUS word ("de raio X,"); a too-short unit may take the first word of the
next one. A later word of a multi-word unit is dimmed (45 %) until it is spoken. Unit fade-in 2 f. A unit that
started inside a `captions.hide` interval is not flashed for its last frames after the interval.

### 13.8 Elements
- `tokens.STROKE`: mark 5 / under 8 / guide 3 px (were 3 / 5 / 2). `CHIP_H` 64, `CHIP_SIZE` 32.
- Chip: 64 px pill, 32 px type, 14 px dot. A single chip shrinks its type to 28 px before its text would pass
  x 960; rows start at 32 px and tighten down to 22 px as before. Body chips stay centred on the old 56 px box.
  Docks: BL / BR chip top = stageBottom - 80, BL2 = stageBottom - 152 (`ctx.dock`). Glyph = 40 px badge (white
  ring + 3.5 px check; accent disc + graphite "?"), wobble +-14 deg + swell, 10 f flip, the pill pulses x 1.06 on
  the flip. `exit: "compact"`: every chip of the row makes the same move with a 2 f stagger (no pile-up).
- CountTick 52 px / 30 px numeral, 2 px leader. Brackets: 40 px arms, `fadeTo` 0.4 is drawn at 0.6.
- CursorHalo rides the arrow (`cursor.follow()`), ring 72 px / 2.5 px.
- HUD: tag 36 px (auto-fit to x 124..620 when the storyboard has readouts), readout label 28 px, zero tag 42 px,
  the tenths digit is left-aligned after the comma, the digits leave upwards by 20 px only.
- HERO ENTRANCE for `PropCard` and for `Prop` beats placed by `screen` / `slide` (not for path-glued props such as
  c3's chevrons): on its word the prop pops in the MIDDLE of the stage at about 430 px over a dim(0.6) stage,
  holds 20 f, then flies (14 f) to its storyboard position. A `Prop` whose `fly` starts earlier (c1 coin) waits
  in the centre and flies from there. `"hero": false` in the beat's props opts out. Body only (at >= H + 16).
  `screen/shared.tsx` exports `heroEntrance(ctx, box)` + `<HeroDim>` for cut-specific cards (c6 FoldCard).

### 13.9 Scripts
- `scripts/stills.mjs`: fixed HTTP ports per semaphore slot (3511.., 3521..) and up to 2 retries per frame. The
  semaphore now has 2 slots (stills and full renders share it): measured with 5 stills per process, two processes
  at once take 10-13 s each, three take about 70 s each with font and port time-outs.
- `scripts/render.mjs <comp> <out.mp4|out.wav>`: full render through the same semaphore on the slot's own port
  (+9), started with node directly (no npx), one retry. Use it instead of `npx remotion render`. After an .mp4
  render it re-muxes the file (stream copy) with an edit list that removes the AAC priming: Remotion's own MP4
  plays the audio 2048 samples (43 ms) late; `--keep-audio-delay` skips that step.
- `scripts/dump.mjs [c1 ..] [--units] [--cues] [--cam]`: resolves the storyboards without rendering and prints the
  caption units (flags SHORT units and late words), the accepted / skipped sound cues, camera keys, punches and
  resolved beat frames.
- `scripts/onsets.py`, `scripts/face_track.py`: regenerate `onsets.json` / `face-track.json` (only if media change).

## 14. Looks (one identity, a different look per cut)

Files: `look.ts` (themes, layout options, overrides), `components/Looks.tsx` (logo, hook logo, hook pills, scrims),
`tokens.ts` (live `C` / `dim`). Sections 1-13 describe the DEFAULT look, which is the approved "leva 4" output and must
stay pixel-identical: `rp-c1 .. rp-c6`, `rp-lab-*` and the ALT ids never pass a look.

### 14.1 Selecting a look
A look is a prop of the composition, not of the storyboard: `<AulaCut storyboard={sb} look="branco" />`.
`storyboards.ts` exports `AULA_LOOKS` (`{ id, storyboard, look }`), `Root.tsx` registers them next to the plain
ids. Pilot ids = `rp-<storyboard id>-<look id>`:

| Composition | Storyboard / cut module | Look |
|---|---|---|
| `rp-c1-branco` | c1 / CoinProp | `branco`: white page, stage card with a soft shadow, wordmark top right in the hook |
| `rp-c2-tela-cheia` | c2 / BombomProp | `tela-cheia`: full-bleed picture behind graphite scrims, headline over its lower part |
| `rp-c3-azul-claro` | c3 / TracheaPush | `azul-claro`: light blue page, dark type, accent word on a graphite tab |
| `rp-c5-duas-cores` | c5 / RibArc | `duas-cores`: top 52 % graphite, bottom 48 % baby blue; hook pills from the storyboard override |
| `rp-c6-azul-bebe` | c6 / SkinFold | `azul-bebe`: baby blue page; hook with the camera block large on top |

A new pilot = one `pilot(cN, "<look>")` line in `storyboards.ts`. `resolveStoryboard(sb, lookId)` returns
`r.look` (always set: the default look for the plain ids) and `r.sb` = the EFFECTIVE storyboard (14.4).
Stills / renders work as for any id: `node scripts/stills.mjs rp-c5-duas-cores --frames 0,60 --scale 0.35`.

### 14.2 Where colours come from (three groups)
1. **Page inks** (`Ink`, look.ts): everything OUTSIDE the stage. The engine components pick the ink by the screen y of
   what they draw: `inkAt(look, y)` returns `look.ink`, or `look.split.ink` below `look.split.y`. That is how
   "duas-cores" works: HUD / headline (y < 998) use the dark ink; CTA, captions, lockup, name tag and the camera
   block's chrome use the blue one. Fields:

   | Field | Use | default / pilots' dark | `branco` | blue (`azul-claro`, `azul-bebe`, lower half of `duas-cores`) |
   |---|---|---|---|---|
   | `text` | titles, captions, digits | `#FFFFFF` | `#3C3C3C` | `#1C1E22` |
   | `text2` | kicker, labels, lesson | white 72 % | `#6E6E6E` | `#3C3C3C` |
   | `line` | rail track | white 10 % | `#E3E3E3` | graphite 16 % |
   | `quote` | quotes of a verbatim headline | white 72 % | `#6E6E6E` | `#1C1E22` |
   | `mark`, `railFill` | NON-text accents (dots, rail fill) | accent, accent gradient | same | `#1C1E22` |
   | `head` | accent word of the hook / closing headline | `{mode:"colour", color:#60AFF0}` | same (see 14.7) | `{mode:"tab", fill:#1C1E22, text:#DCEEFC or #BFE0FB}` |
   | `word` | accent word of a caption, "aula completa" in the CTA | colour `#60AFF0` | tab: accent fill, graphite text | graphite tab, light text |
   | `digits` | countdown, last 3 s | `#60AFF0` | `#3C3C3C` | `#1C1E22` |
   | `capDim` | opacity of a caption word not spoken yet | 0.45 (pilots 0.5) | 0.74 | 0.7 |
   | `dots`, `onText` | silence dots; type on a block filled with `text` (filled hook pill) | | | |
   | `token` | `{color, accent}` handed to the cut's Prop in the kicker row / tokenHome | none (Prop defaults) | `#3C3C3C` / accent | `#1C1E22` / `#6F92BF` |
   | `pill` | lockup pill `{fill, text}` | accent gradient / graphite | same | graphite / white |
   | `logo` | `{file: "branco" or "claro", card}` | white wordmark | dark wordmark, no card | dark wordmark on a white card |
   | `cam` | camera block `{border, shadow}` | 1 px line | `#E3E3E3` line + shadow | shadow only |
   | `nameTag` | "NOME DO APRESENTADOR" | white 72 % | `#6E6E6E` | `#1C1E22` |

   Measured contrast of these pairs (out/looks/contrast.py): `#3C3C3C` on white 11.0, `#6E6E6E` on white 5.1 (4.9
   on `#F4FCFE`), graphite on the blues 10.5-14.1, `#3C3C3C` on the blues 6.9-9.3, graphite on the accent tab 7.1,
   light tab text on graphite 12.1-14.1; unspoken caption words at `capDim` 4.6-5.1 on every page.

2. **On-film palette** (`look.film`, tokens.ts): everything INSIDE the stage (marks, chips, cards, covers, props on
   the film) keeps reading `C` and `dim()`. Both are now LIVE: `C` is a Proxy that answers with the palette of the
   look being rendered (`AulaCut` calls `setFilmPalette(r.look.film)` before its children render; one
   AulaCut is mounted per page). All five pilots leave it at the default dark palette on purpose: a radiograph
   is a dark picture on any page colour, so marks, chips and cards stay exactly as approved and can never go
   white-on-white. A look (or a storyboard override) can still re-colour the stage content without touching a
   single element file, e.g. `"look": { "film": { "cardFill": "rgba(255,255,255,0.92)", "white": "#1C1E22" } }`
   (verified on a still: chips and cards turn white with dark type, white marks turn dark). Limit: `white` is
   shared by marks and chip text. `film.dimRgb` ("r,g,b") re-bases `dim()`.
3. **Chrome**: `look.bg` (`color`, `css`, `light` = drifting radial light), `look.split` (`y`, `css`, `ink`),
   `look.stage` (`bg`, `border`: undefined = default line / null = none / CSS, `shadow`), `look.badge`.

Rules for element and cut authors:
- Inside the stage (Under / Slide / Screen / Over layers): keep using `C` and `dim()`, and READ THEM AT RENDER
  TIME (inside the component, layer or helper call). A module-level `const X = C.accent` freezes the default.
  Audit of the engine: no such constant exists. The two literal copies of the accent (`accentA` in
  `elements/slide/shared.ts`, `ACC` in `cuts/c4.tsx`) now use the live `accentA(a)` of tokens.ts; default
  parameters such as `color = C.white` are evaluated per call and are fine. Never write a hex / rgba literal.
- A Prop must honour its `color` / `accent` props (all six do): in "token" placement the engine passes the ink of
  the surface the token sits on. Do not hard-code `C.white` for a stroke.
- Anything a cut draws on the PAGE (nothing does today) must use `inkAt(ctx.look, y)` (exported by `elements/api`
  with the `Ink`, `Look`, `AccentWord` types). `ctx.look` and `ctx.r.look` are the active look.
- `ctx.tokens.C` is the same live object as `C`.

### 14.3 Layout options (`look.layout`)
- **(a) `badge: true`**: series badge at the start of the kicker row (accent tab, graphite 28 px caps, 7.1 : 1),
  before the kicker text; with a token in the row the order is token, badge, kicker. Text = `hook.badge` or
  `CASO 0N` built from the digits of the storyboard id. It lives and dies with the kicker (hook, closing).
- **`stage: { hook, body, close, end }`**: the four stage boxes `{x0, x1, top, bottom}` (reference: hook and close
  40..1040 x 716..1210, body 40..1040 x 360..1210, end 40..1040 x 716..1052). Same clocks as before: hook -> body
  over H..H+16 (OUT), body -> close over P..P+16 (INOUT), close -> end over T+10..T+26 (INOUT); x and the bottom
  edge may travel too. `ctx.stage`, docks, dims, ScanLine, the headline / CTA clips all follow it.
  **Camera rule (all looks):** storyboard cameras, pins and slot cameras are evaluated in the REFERENCE stage,
  exactly as before, and the result is transplanted: the slide point at the centre of the reference box sits at
  the centre of the look's box, scale x (look box width / 1000). So nothing has to be re-keyed for the picture to
  keep its framing; a box of another aspect just shows more or less slide above / below (the film clip still
  hides everything that is not a film). PaneSplit hooks (c1) need the reference boxes: resolve throws otherwise.
- **(b) `bleed`** ("tela-cheia"): the stage clip becomes the whole frame (no box, no radius, no border), the page
  background shows where no film is, and two graphite scrims are painted INSIDE the stage clip, above film /
  patches / covers and below every element layer (chips and marks stay on top):
  top scrim = alpha 0.9 from y 0 to `hookTop` 320 / `bodyTop` 350 / `closeTop` 706, fading to 0 over `topFade`
  200 px; bottom scrim = 0 at `bodyBottom[0]` 1170, solid graphite from `bodyBottom[1]` 1262 (after T+10:
  `endBottom` 960 / 1066, so the CTA line sits on graphite); in the hook it starts `hookLead` 180 px above the
  headline, reaches 0.9 24 px above its first cap-top and is solid from max(`hookSolid` 1250, headline bottom
  + 20). Alpha 0.9 keeps white, text2 and accent type at >= 4.5 : 1 even over a pure white film.
  Camera mapping in this mode (the general rule with these boxes): the stage boxes are FULL-WIDTH windows, each
  = the reference box scaled x 1.08 about its own centre: body 0..1080 x 326..1244 (centre 785, unchanged),
  close 696..1230, end 703..1065; the hook window is centred higher, at y 640 (373..907), because the headline
  covers the lower part of the picture. So a body key `{cx, cy, s}` shows slide point (cx, cy) at screen
  (540, 785) at scale s x 1.08 (c2: 1.4 -> 1.512), i.e. the picture of the default layout enlarged 8 % about the
  stage centre and no longer cut by the box; in the hook the slot camera's centre sits at (540, 640) instead of
  (540, 963). Docks do NOT follow the window: `ctx.stage.dock` carries the reference box and `ctx.dock()` /
  `dockPos` use it, so chips sit where they sit today. `ctx.stage` itself is the window (dims, ScanLine and
  Spotlight cover the full width). Elements that compute positions from `ctx.stage.left / top` by hand (Chip
  rows clamp to `stage.left + 8`, EquationBar, Compare) get the window: check them on stills.
  What the c2 owner may want to re-key: nothing breaks with the default keys, but c2's film is landscape
  (1128 x 581 slide px), so at s 1.4 it only covers y 346..1225 of the frame and its top edge shows faintly
  under the scrim. To make the picture run up behind the HUD use tighter keys (film height on screen =
  581 x s x 1.08; s about 1.9 covers y 190..1380) and re-check `cy`. Scale limit: the storyboard value is still
  capped at 2.0, so the effective scale can reach 2.16 in this mode.
- **`headline: { x, capTop, bottom, maxWidth, clip }`**: place of the hook headline. `bottom` (baseline of the
  LAST line) wins over `capTop`; `clip: false` switches off the "only above the stage's top edge" clip (needed
  whenever the headline is not above the stage). `hook.tokenHome` and the collapse into the HUD tag follow it.
  tela-cheia default: `bottom: 1226` (above the caption band). The mockup's lower position is
  `"look": { "layout": { "headline": { "bottom": 1430 }, "hookCaptions": false } }` (the headline then owns the
  caption band until H).
- **`hookCaptions: false`**: no captions before H.
- **(d) `hookCam: { x, y, w, h, radius }`** ("cam on top" hook): the camera block is drawn there until H, then
  travels to `Z.cam` over 18 f (INOUT; `camRectAt`, `CAM_TRAVEL` in FaceBubble.tsx) while the stage box travels
  from `stage.hook` to `stage.body`. Keep w <= 1.59 x h (CamCrop shows the tile's side edges otherwise). During
  the hook the name tag is a white pill in the block's bottom-left corner (where the burned-in webcam label is
  painted out, never over his face); the tag under the bottom block appears once the block has landed.
  azul-bebe: block 960 x 610 at (60, 330), headline cap-top 1010, stage.hook = a small card 560..1020 x
  1390..1810, `hookCaptions: false`, wordmark card bottom left. The mockup's 3 degree tilt of the small
  radiograph is not implemented.
- **`hookLogo: { x, cy, h, align }`**: the wordmark during the hook (out with the kicker), in the logo variant of
  the ink at `cy`; `x` = left or right edge (of the card when there is one), `h` = art height.
- **(e) hook pills**: storyboard `hook.pills = { labels, x | right, cy, size, at }` (not a look option, so it can
  be given per look through 14.4). First pill filled with the ink's text colour, the others outlined; in place
  on frame 0 (or popping on `at`), they take turns pulsing every 18 f and leave with the kicker. Default place:
  right-aligned at x 960 in the kicker row. Neutral labels only (c5: "CERTO" / "ERRADO").
- **(c) split** is a theme field (`look.split`), not a layout option: see 14.2.

### 14.4 Per-look overrides in a storyboard
```json
"looks": {
  "tela-cheia": {
    "look": { "layout": { "headline": { "bottom": 1430 }, "hookCaptions": false } },
    "captions": { "hide": [[0, 104], [960, 1008]] },
    "camera": [ "...the whole re-keyed track..." ],
    "patchBeats": { "chipFacil": { "props": { "dock": "BL" } }, "scanThink": null },
    "addBeats": [ { "id": "x", "el": "ScanLine", "at": { "f": 300 }, "props": { "from": 300, "dur": 20 } } ]
  }
}
```
`applyLook(sb, lookId)` (look.ts, memoised): everything except the three special keys is DEEP-MERGED over the
storyboard (objects merge key by key, ARRAYS AND SCALARS REPLACE, `null` replaces); `look` is deep-merged over the
look's definition (any `ink`, `split`, `layout`, `stage`, `film` ... field); `patchBeats` merges into the beat with
that id (`null` removes it; an unknown id throws); `addBeats` are appended. The default look never reads the
block, so adding one cannot change `rp-cN`. In use today: `c5.json` -> `looks["duas-cores"].hook.pills`.
Anchors inside an override are validated like any other (the error message names the look).

### 14.5 What changed in engine files (for readers of sections 1-13)
`timeline.ts`: `stageAt` reads `look.layout.stage` (`refStageAt` = the reference box, used by the camera);
`stageViewAt` transplants the camera; `scrimsAt`. `Headline.tsx`: `layoutHeadline(..., tabPadEm)` reserves room
round a tabbed accent phrase, `HeadlineView` takes `ink`. `Hud.tsx`: `hookHead(r)` = hook headline layout +
place + ink; kicker badge. `FaceBubble.tsx`: `camRectAt`. `Stage.tsx`: `ClipBox` takes `line` / `shadow`; scrims.
`elements/context.ts`: `dockPos` uses `stage.dock`; `ctx.look`. `AulaCut.tsx`: `look` prop, `Background`
takes `look`. `resolve.ts`: `resolveStoryboard(sb, lookId)`, `r.look`, `r.badge`, `r.pillsAt`.

### 14.6 Regression gate
`out/looks/ref/<comp>/` holds stills of rp-c1, c2, c3, c5, c6 taken before the look system; `py -3.12
out/looks/cmp.py <dirA> <dirB>` compares two such trees pixel by pixel (Pillow). `node out/looks/test_look.mjs`
compares, for EVERY frame of every plain storyboard, the stage rect, the stage view and the pane views of this
engine with the pre-look engine (backup in `out/looks/bak/`), and unit-tests `applyLook` and the live tokens. Run
both after any engine change. Note: frame 0 of a cut can differ by a handful of pixels between two runs of the
SAME code (seen on rp-c2 and rp-c6: 5-7 pixels on the background row y 730 and one glyph edge): re-render before
blaming a change.

### 14.7 Known limits (not done)
- `branco`: the big headline accent word keeps `#60AFF0` on white as in the approved mockup; that is 2.4 : 1
  (below 4.5 : 1 and below the 3 : 1 of large type). Every smaller accent word is on an accent tab instead. One
  override fixes the headline too:
  `"look": { "ink": { "head": { "mode": "tab", "fill": "#60AFF0", "text": "#1C1E22" } } }`.
- Cut polish is not done: positions follow the default layout wherever the mockup's first frame would collide
  with the captions (c5 pills are in the kicker row, c3 has no giant quote glyph, c1 has no big coin beside the
  headline, c2 keeps the default camera keys).
- PaneSplit hooks only with the reference stage boxes; no rotated stage card; the hook pills have no selected /
  answered state by design.
