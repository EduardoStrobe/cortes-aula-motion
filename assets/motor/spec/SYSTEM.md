# Aula cuts v2 — PRIMARY format "Manchete Viva" — design system

Final, buildable specification for the 6 teaser cuts (c1..c6). 1080x1920, 30 fps, Remotion 4.0.526 / React 19.
Per-cut storyboards: `spec/c1.md` … `spec/c6.md`. Alternative format (2 cuts only): `spec/ALT.md`.
Measured inputs shipped with this spec: `spec/data/cursor-<id>.json` (the doctor's mouse pointer, per frame) and
`spec/data/face.json` (face-bubble crop keyframes).

One-paragraph summary: each cut opens at frame 0 with a huge ALL-CAPS Manrope headline over an already-moving crop of
the radiograph while the doctor is already speaking. After about 3.3 s the headline collapses into a slim HUD (tag +
a countdown to the doctor's own spoken question) and the radiograph takes a 1000x850 stage. In the body, every graphic
is anchored to a spoken word: dot-chips, rings, brackets, traces drawn from the doctor's real mouse pointer, and one
line-art PROP per cut that appears at 130+ px when he names the thing (coin on "metálico", bombom on "bombom", push
chevrons on "empurrando", blank report on "laudo", rib arc on "retificação", skin fold on "dobras"). One-word captions
pop beside a circular face bubble. The closing mirrors the hook layout: the open question is built word by word during
the last spoken sentence, then a short sign-off (prop callback, "A resposta está na aula completa.", lockup).

---

## 0. Non-negotiable rules (apply to every decision below)

1. **Brand.** Manrope only, weights 600 and 400 only. Colours only from section 1. Accent blue is a point of colour
   (dots, one word, strokes, the small CTA pill) and never a large flat area. No text outlines, no text shadows, no
   glows, no cartoon characters, no other hues (radiographs are rendered grayscale).
2. **Truth.** On-screen text is (a) verbatim from the speech, (b) a neutral framing question, or (c) a label of
   something visibly on the slide. No invented facts, numbers, diagnoses, prizes or promises. No cut reveals its answer.
   Never use game/paywall vocabulary ("TEMPO ESGOTADO", "PRÊMIO", "RESPOSTA BLOQUEADA", "VEREDITO", "CORREÇÃO").
3. **Annotation honesty.** A mark is placed on anatomy only where the doctor's pointer goes (use the cursor data) or
   where the structure is unambiguous (whole lungs, the round metallic object). Where he does not point, use a DOCKED
   chip (no pin, no leader). No left/right arrows, no "D/E" side markers, no midlines, no rulers, no measurements.
4. **Privacy.** Only the film rectangles listed per cut are ever drawn; everything else on the slide is clipped away.
   Patches listed per cut are always on. Students never appear (the footage already excludes them).
5. **Safe zones.** Nothing readable in y < 220, y > 1500 or x > 960. The film itself may run to x = 1040.
   Captions >= 64 px. Text never sits on the film except chips/labels, and those never cover the structure under
   discussion (each storyboard lists a `protect` rect where relevant).
6. **Sync.** Every element enters on a spoken word taken from `src/data/<id>.json` (`palavras[]`), within +-2 frames.
   Storyboards cite words as `word#occurrence [idx N] fF (T s)`; frame = `Math.round(s * 30)`. The composition must
   resolve anchors from the JSON at render time and throw if the resolved frame differs from the storyboard's `f` by
   more than 1.
7. **No image processing on the radiograph** other than `filter: grayscale(1)` (removes a slight tint in c2) and
   the dimming/blur used for transitions. No sharpening, no contrast boost, no colour tint over a lesion.
8. **Length.** Composition length = `frames` (speech) + 102 (closing, 3.4 s). The video and audio start at frame 0;
   nothing delays the first word.

---

## 1. Canvas, colours, fonts

- Canvas 1080x1920, 30 fps. Background: `linear-gradient(160deg, #1C1E22 0%, #1E2228 100%)` plus one radial light
  (`radial-gradient(600px circle, rgba(255,255,255,0.03), transparent)`) whose centre drifts linearly from (300,500)
  to (340,520) over the whole composition, so the frame is never fully still.
- Colour tokens (use these names in code; no other colour may appear in UI):

| Token | Value | Use |
|---|---|---|
| `graphite` | `#1C1E22` | background, under-strokes, dims |
| `graphite2` | `#1E2228` | stage background, cards, covers, privacy notches |
| `white` | `#FFFFFF` | titles, numerals, captions |
| `text2` | `rgba(255,255,255,0.72)` | labels, sub-lines, leaders, guides |
| `line` | `rgba(255,255,255,0.10)` | borders, rail track |
| `accent` | `#60AFF0` | one headline word, chip dots, marks on film, countdown last 3 s |
| `accent2` | `#6F92BF` | gradient pair only |
| `accentGrad` | `linear-gradient(135deg, #60AFF0 0%, #6F92BF 100%)` | CTA pill, rail fill |
| `cardFill` | `rgba(30,34,40,0.92)` | chips, bars (graphite2 at 92 %) |
| `dim(a)` | `rgba(28,30,34,a)` | spotlight / closing dims, mark under-strokes |
| `filmBlack` | `#000000` | ONLY for the c2 film-marker patch (matches the film's own black background) |

- Fonts: `public/fonts/Manrope-SemiBold.ttf` (600) and `public/fonts/Manrope-Regular.ttf` (400), loaded with
  `FontFace` + `delayRender/continueRender`. `font-family: 'Manrope'`. Never synthesise other weights
  (`font-synthesis: none`).
- Line weights: UI borders, leaders, rail track, dividers = **1 px**. Marks drawn on the radiograph (ring, trace,
  chevrons) = **3 px accent** with a 5 px `dim(0.5)` under-stroke (legibility over bright bone on a phone); guides and
  brackets = **2 px white**. This is the only deviation from the brand's 1 px rule and applies to marks on film only.

---

## 2. Layout zones (px on 1080x1920)

The frame has three vertical bands that never overlap. The stage has two heights: SLOT (hook and closing) and BODY.

| Zone | Rect | Content |
|---|---|---|
| Z0 top unsafe | y 0-220 | empty background |
| Z1 HUD row | x 60-960, y 232-332 | HOOK/CLOSING state: kicker row. BODY state: HUD (tag left, readout right) |
| Z1b headline zone | x 60-960, y 348-692 | hook headline / end question (HOOK and CLOSING states only) |
| Rail | x 40-1040, y 344 | BODY state only: 1 px track `line`, 2 px `accentGrad` fill |
| Z2 stage, BODY | x 40-1040, y 360-1210 (1000x850, centre (540,785)) | radiograph + annotations |
| Z2 stage, SLOT | x 40-1040, y 716-1210 (1000x494, centre (540,963)) | same stage, top edge lowered |
| Z2 stage, CLOSING-END | x 40-1040, y 716-1052 (1000x336, centre (540,884)) | slot after the CTA line enters |
| Zcta | x 60-960, y 1076-1216 | closing only: CTA line (2 lines) |
| Z3 caption band | y 1236-1470 | face bubble (circle d 208, centre (164,1352)); caption box x 300-956, word centre y 1322; name tag x 300, y 1420-1452 |
| Z4 bottom unsafe | y 1500-1920 | empty background |

Stage look: `border-radius: 28px`, `border: 1px solid line`, background `graphite2`, `overflow: hidden`.
Stage docks (screen px, relative to the CURRENT stage rect, so they follow the edges when the stage resizes):

| Dock | Position of the chip/card |
|---|---|
| `TL` | left x 60, top = stageTop + 16 |
| `TR` | right x 940, top = stageTop + 16 |
| `BL` | left x 60, top = stageBottom - 72 |
| `BL2` | left x 60, top = stageBottom - 136 (second row above BL) |
| `BR` | right x 940, top = stageBottom - 72 (cards: bottom = stageBottom - 16) |
| `{x,y}` | explicit screen position of the chip's left/top |

Items sharing a dock with `row: true` flow left to right with a 12 px gap.

---

## 3. Source crops

Source frame 1920x1080. Slide region x 7, y 84, w 1367, h 912. Webcam tile x 1503, y 389, w 417, h 302.

### 3.1 Slide space and camera
All annotation coordinates are in SLIDE space: x 0..1367, y 0..912 (slide pixel (x,y) = source pixel (x+7, y+84)).
Camera `cam(cx, cy, s)`: slide point (cx,cy) sits at the stage centre; `s` = screen px per slide px; **s <= 2.0**.

```
screenX = 540      + (x - cx) * s
screenY = stageCy  + (y - cy) * s        // stageCy = current stage centre y (785 BODY, 963 SLOT, 884 CLOSING-END)
visible slide width = 1000 / s ; visible slide height = stageHeight / s
```
A camera may also be given as a pin: `{ pin:[sx,sy], at:[X,Y], s }` = slide point (sx,sy) is held at screen (X,Y).
When the stage top edge animates, `stageCy` animates with it and the camera keeps its slide centre at the moving
centre.

Implementation: a div of 1367x912 containing the video (positioned at -7,-84) and one SVG overlay of the same size
(`viewBox="0 0 1367 912"`), transformed with `translate(540 - cx*s, stageCy - cy*s) scale(s)`, origin 0 0, inside the
stage (`overflow:hidden`). Strokes in the SVG use `vector-effect: non-scaling-stroke`. Chips, numerals, props and
labels are HTML in SCREEN space, positioned through the mapping above, so their size never scales with the camera.

### 3.2 FilmClip, covers, patches
- Only the film rectangles of the cut (`films[]`, slide space) are drawn: apply a `clip-path` union of those rects
  (2 px inset, radius 4 slide px) to the video. Everything else (slide gray, slide titles, PowerPoint controls,
  other images) shows the stage background. Film rects are cut at y <= 878 (PowerPoint control bar).
- `covers[]`: opaque cards in slide space (`graphite2`, 1 px `line` border, radius 16 screen px) drawn over film
  rects that must never be seen (c1 profile films). The covered films are ALSO excluded from `films[]`, so their
  pixels never reach the canvas. A cover shows a 24 px lock glyph (1.5 px stroke, `text2`) at its centre until its
  label chip appears.
- `patches[]`: always-on rectangles in slide space above the video and below annotations. `fill:"stage"` =
  `graphite2` with a 1 px `line` border on the inner edges and inner radius 12 screen px (reads as a notched corner);
  `fill:"filmBlack"` = `#000`, no border.
- Stage video: `<OffthreadVideo muted>` with `style={{ filter: 'grayscale(1)' }}`. Sound comes from ONE `<Audio>` of
  the same file. `freezeStageAt` (c3 = 1084): the stage shows frame `min(frame, freezeStageAt)`; audio and bubble
  keep playing. In the closing the stage shows frame `min(frames - 1, freezeStageAt ?? frames - 1)`.
- Pre-cropping proxies with ffmpeg is allowed for render speed; keep slide-space origin identical (note that ffmpeg
  rounds odd crop widths on yuv420p: crop 1368x912 at x 6, y 84 and offset by 1 px, or convert `format=gray` first).

### 3.3 Hard joins in the footage
Join frames = `Math.round(segmentos[i].out_start * 30)` for i > 0 (c1: 852; c2: 160, 232, 432; c3: 231, 632;
c4: 853, 916, 1056; c5: none; c6: 101). On every join frame J the composition automatically plays **JoinBlink**
(section 8.20): accent line sweep across the stage, bubble re-pop, half-level whoosh. Camera keyframes that the
storyboard places on a join are HARD CUTS on J (no easing), so the jump reads as an intentional beat.

### 3.4 Face bubble
- Canvas: circle d 208, centre (164,1352). Border ring 1 px `line` at the circle edge; outside it, at radius 110,
  a 2 px `accent` arc of 90 deg (from -80 deg to +10 deg, 0 deg = 3 o'clock) = **speaking arc**: opacity 1 while a
  word interval `[s,e]` is active, 0.25 otherwise (6 f linear transitions). On every caption unit start the bubble
  scales 1 -> 1.04 -> 1 (6 f).
- Source: second `<OffthreadVideo muted>` of the same file. Crop = circle of radius **118 source px** centred at
  tile-local (cx(f), 146), i.e. source (1503 + cx, 535); displayed at scale 208/236 = 0.881. `cx(f)` comes from
  `spec/data/face.json` -> `<id>.keys` (`[frame, cx]` every 15 f, linear interpolation, already clamped to
  118..299). With cy = 146 and r = 118 the circle spans tile y 28..264 and can never include the burned-in
  "Nome do Apresentador" label (tile-local x 14-134, y 271-293). Do not change r or cy without re-checking that.
- **Face-lost fallback.** `face.json -> <id>.lost` lists intervals where his face leaves the frame or is hidden
  (c2 84-116 ducks; c4 430-476 leaves the frame; c5 28-72 rubs his head, 232-278 only hair). During a lost interval
  `[a,b]`: cross-fade (6 f, starting at a-6) from the live crop to a STILL of the bubble taken at frame `face.still`
  (per storyboard; a frame with eyes open), slowly zooming 1 -> 1.03; cross-fade back over 6 f from b. The speaking
  arc keeps working, so the bubble still reads as "him talking".
- On join frames the bubble re-pops: scale 0.94 -> 1, 6 f, easing OUT.
- Name tag: "NOME DO APRESENTADOR", Manrope 600, caps, 26 px, +0.14em, `text2`, left x 300, box y 1420-1452.
- Closing: the bubble freezes on frame `frames - 1` (or `face.still` if the storyboard sets `closing.faceStill`).

---

## 4. Typography scale (Manrope; 600 unless noted)

| Role | Size px | Case | Tracking | Colour | Notes |
|---|---|---|---|---|---|
| Hook headline / end question | 72-104 (per cut; auto-fit so the widest line <= 900 px, measured with `@remotion/layout-utils` `measureText`) | ALL CAPS | -0.02em | white; ONE accent word/line | left x 60; `line-height: 0.78` trimmed + bottom margin so line pitch = 1.04 x size; first cap-top at y 356 |
| Quote marks (verbatim headlines) | same size | — | — | `text2` | typographic “ before the first word and ” after the last; inline, never hung outside x 60 |
| Kicker | 28 | caps | +0.16em | `text2` | "TÓRAX PEDIÁTRICO"; x 164 (after the token) or x 60 (no token); centre y 282 |
| HUD tag | 30 | caps | +0.12em | white | <= 20 chars per line, <= 2 lines, pitch 38; x 124; 1 line: centre y 262; 2 lines: centres y 262 / 300 |
| HUD sub line | 26, weight 400 | sentence | 0 | `text2` | x 124, centre y 306 (only with a 1-line tag) |
| Readout label | 26 | caps | +0.16em | `text2` | right-aligned at x 960, box y 236-266 |
| Readout digits | 64 | — | 0 | white (accent in last 3 s) | tabular: each digit in a 40 px cell, ":" and "," in 20 px cells; right-aligned at x 960, box y 268-332 |
| Zero tag ("● SUA VEZ") | 34 | caps | +0.12em | white, 12 px accent dot | right-aligned at x 960, centre y 300 |
| Chip text | 28 | caps | +0.12em | white | max 32 chars |
| Cover / card label | 24 | caps | +0.14em | `text2` | |
| CountTick numeral | 24 | — | 0 | see 8.13 | |
| Caption | 92 (auto-fit down to 64) | as transcribed | -0.01em | white; trigger word `accent` | section 5 |
| Name tag | 26 | caps | +0.14em | `text2` | |
| CTA line | 64 | sentence | -0.01em | white, "aula completa" in `accent` | 2 lines, pitch 70 |
| Lockup name | 40 | sentence | 0 | white | "Nome do Apresentador" |
| Lesson name | 30, weight 400 | sentence | 0 | `text2` | 2 lines, pitch 38 |
| Pill text | 30 | caps | +0.08em | white | "ASSISTA À AULA COMPLETA" |

Hierarchy comes from size and colour, never from weight. Use non-breaking pairs (kit `glue()` from
`src/kit/Phrase.tsx`, or ` `) so a line never ends with a 1-2 letter word.

---

## 5. Captions (one word at a time, REF A)

Source: `palavras[]` (`w`, `s`, `e`). Text exactly as transcribed (keep punctuation and capitalisation).

Unit building (deterministic, run once per cut):
1. Start with one unit per word.
2. **Glue**: a word of <= 3 letters (ignoring punctuation) that does not end a sentence is glued to the NEXT word
   (max 2 words per unit, max 16 characters).
3. **Minimum display time**: a unit is shown from its first word's start frame until the next unit's start frame. If
   that is < 8 f, merge it with the following unit if the result is <= 18 characters; otherwise with the previous
   one if THAT result is <= 18 characters; otherwise leave it (it may then last 5-7 f). Repeat until stable.
   (Simulated on the six transcripts: 20-55 units per cut, none shorter than 8 f after merging.)
4. **Fit**: font size = 92 px, reduced so the unit is <= 640 px wide, floor 64 px (if still wider at 64, split the
   unit back at the word boundary).

Display: unit centred on x 628, vertical centre y 1322. In: 4 f, `scale 0.86 -> 1`, `opacity 0 -> 1`,
`translateY 14 -> 0`, spring POP (section 6). Out: hard replace by the next unit. After a pause > 0.5 s
(next start - this end > 15 f) the unit fades out over 6 f starting at `e` + 6 f. During silences > 1.5 s the
caption box shows three 10 px `text2` dots pulsing in sequence (each 0.3 -> 1 -> 0.3 opacity, 10 f, 5 f stagger).

Colour and emphasis (per storyboard, `captions.accent[]` / `captions.emphasis[]`):
- an **accent** word turns `accent` on its own frame (it is the word that triggers an on-film element: blue word in
  the caption = blue dot on the chip);
- an **emphasis** unit is shown at x1.35 size, clamped so its width stays <= 640 px.

Hidden: captions draw nothing during `captions.hide[]` intervals (while a headline or end question shows the same
words word-synced). If a phone test of c3 or c6 (2.7-2.8 words/s) flickers, switch THAT cut to phrase mode as
defined in `ALT.md` section 4 (same band, 60 px); this is the only allowed caption fallback.

---

## 6. Motion language

Easings: `OUT = bezier(0.16, 1, 0.3, 1)`; `INOUT = bezier(0.65, 0, 0.35, 1)`;
`POP = spring({ fps: 30, config: { damping: 14, stiffness: 220, mass: 0.6 } })` (overshoot <= 4 %).
No shakes (except Cover "locked shake", 8.4), no bounce > 4 %, no glows.

| Animation | Property: from -> to | Frames | Easing |
|---|---|---|---|
| Headline line slam | translateY 40 -> 0, opacity 0 -> 1 | 5, stagger 3 f per line | OUT |
| Headline word punch (verbatim, on its word) | scale 1 -> 1.07 -> 1 (origin left-centre of the word) | 6 | OUT |
| Accent colour sweep | clip-path reveal of an `accent` copy, left -> right | 8 | linear |
| Headline -> HUD collapse | headline block: scale 1 -> 0.3 (origin top-left), translate to (124,248), opacity 1 -> 0 during the first 8 f; tag: opacity 0 -> 1, translateX -12 -> 0 during f+6..f+14 | 14 | OUT |
| Token resize | 84 -> 48 px (or back), position (60,240) -> (60,236) | 14 | OUT |
| Stage edge move (open / close / closing shrink) | top 716 <-> 360, bottom 1210 -> 1052 | 16 | OUT (open), INOUT (close) |
| Camera move | cx, cy, s interpolated together | 16-22 (per beat) | INOUT |
| Camera drift (between keyframes, always on) | s x (1 + 0.005 per second) | continuous | linear |
| Camera punch | s x 1.045 | 6 in, 20 back | OUT / INOUT |
| Chip in | anchor dot opacity 0 -> 1 (4 f); leader strokeDashoffset 100 % -> 0 (6 f); pill scale 0.9 -> 1 + opacity 0 -> 1 (8 f, POP); chip dot scale 1 -> 1.5 -> 1 (8 f) | 8 | POP |
| Chip text roll | old text translateY 0 -> -100 %, new 100 % -> 0 (overflow hidden), width animates | 6 | OUT |
| Chip out | opacity 1 -> 0, translateY 0 -> -8 | 6 | linear |
| Ring draw | strokeDashoffset from 12 o'clock clockwise | 10 (or per beat) | OUT (cubic) |
| Ring breathe | scale 1 -> 1.04 -> 1 | 45 loop | sine |
| Ring / bracket pulse | scale 1 -> 1.12 -> 1 | 8 | OUT |
| Brackets in | each corner travels 20 px inward, opacity 0 -> 1 | 8 | OUT |
| Trace draw (points) | strokeDashoffset | per beat | linear |
| Trace pulse | stroke-width 3 -> 5 -> 3 | 8 | OUT |
| Guide draw | strokeDashoffset | 12 | INOUT |
| CountTick in | scale 0 -> 1 | 6 | POP |
| ScanLine | translateY stageTop -> stageBottom | per beat (18-60) | linear |
| Spotlight | dim opacity 0 -> 0.65 | 8 | linear |
| Countdown in | scale 0.9 -> 1, opacity 0 -> 1 | 8 | POP |
| Countdown last 3 s | digits colour -> accent; scale 1 -> 1.06 -> 1 on each whole second | 6 | OUT |
| Countdown zero | digits translateY 0 -> -100 % + fade (6 f); zero tag POP in (8 f) | 14 | OUT / POP |
| JoinBlink | 2 px accent vertical line, x 40 -> 1040 across the stage | 6 | linear |
| Bubble re-pop | scale 0.94 -> 1 | 6 | OUT |
| Stage tilt (c4) | rotateX 8deg -> 0, translateY 30 -> 0, scale 0.96 -> 1, `perspective: 1200px` | 16 | OUT |
| Cover locked shake | translateX 0 -> +6 -> -6 -> 0, 3 cycles | 12 | linear |
| Prop in | scale 0 -> 1 | 8 | POP |
| Closing rows | translateY 24 -> 0, opacity 0 -> 1 | 6 | OUT |
| Pill grow | width 64 -> full | 10 | OUT |

**Cadence rule.** There must be a visible change (camera keyframe, element in/out/roll/pulse, countdown tick,
scan line) at least every 2.2 s. The storyboards already satisfy this; if a builder removes a beat, fill the gap with
a `ScanLine` (60 f, 40 % opacity), never with a static frame.

---

## 7. HUD (BODY state only)

Left: PROP token (48x48, at x 60, y 236) + tag (section 4). Right: one **readout** at a time.

### 7.1 Countdown (REF B, kept neutral)
Counts down to a word the doctor actually says. Label is always `A PERGUNTA EM` (target = the first word of a
question he asks the audience) or, in c2 only, `A DICA EM` (target = "Vou dar uma dica"). A countdown is never longer
than 12 s: it is ARMED on a word <= 12 s before its target and is absent before that. c5 has no countdown.
- Props: `{ label, arm: Anchor, target: Anchor, zeroTag, clear: Anchor }`.
- Value = `max(0, targetFrame - frame) / 30`, floored to tenths, refreshed every 3 f, format `m:ss,d` with a pt-BR
  comma, e.g. `0:10,8`.
- Last 3 s: digits `accent`, pulse and **tick** sound at targetFrame - 90, - 60, - 30.
- At zero: digits roll out, zero tag `● SUA VEZ` (c2 first chapter: `● A DICA`) pops in with the **pop** sound and
  stays until `clear` (default: the next chapter's arm, or the closing pre-roll).

### 7.2 Tally (c2 only)
Label `ARCOS COSTAIS` (readout label style) + one big digit (readout digit style). The digit rolls up (6 f, OUT) to
the next number on each ordinal word. It shows what he counts aloud; nothing else.

### 7.3 Rail
1 px track from x 40 to x 1040 at y 344; 2 px `accentGrad` fill from x 40 to `40 + 1000 * frame / frames`.
A 1x8 px `text2` notch marks each countdown target on the track. Draws in during the hook collapse (10 f).

---

## 8. Element vocabulary (components and props)

Types used below: `Anchor = { w: string, n: number, off?: number, f: number }` (word, occurrence, frame offset,
expected frame) or `{ f: number }` (absolute frame; only for joins and closing). `Pt = [x, y]` in slide space.
`Rect = [x0, y0, x1, y1]` in slide space. Every element has `at: Anchor` and `until: Anchor | "closing" | "end"`
(`"closing"` = exits at the closing pre-roll; `"end"` = kept to the last frame).

1. **Stage** `{ }` — container (section 2-3). Driven by `camera[]` and the hook/closing templates.
2. **Camera keyframe** `{ at, to: {cx,cy,s} | {pin,at,s}, dur, cut?: boolean }` — INOUT over `dur` starting at `at`;
   `cut: true` = hard cut (joins). Drift is automatic between keyframes.
3. **PaneSplit** (c1 hook) `{ panes: [{ rect:[x,y,w,h] screen, films:[id], camera }] , mergeAt, mergeDur }` — the
   slot is replaced by N panes (each its own video instance and FilmClip); at `mergeAt` each pane's rect and camera
   interpolate (INOUT) to the screen rect of its film in the next stage camera, then the normal stage takes over.
4. **Cover** `{ rect, label, at (label chip), shakes: Anchor[] }` — section 3.2. Label = Chip look (dot + text)
   centred on the cover, with the 24 px lock glyph left of the dot; glyph rocks +-6 deg (10 f) with each shake.
5. **Patch** `{ rect, fill: "stage" | "filmBlack" }` — section 3.2.
6. **Headline** `{ kicker, lines[], accent, quoted, size, wordSync?: Anchor[] -> word index, accentAt: Anchor }`
   — section 9.
7. **HudTag** `{ lines[], sub? , pulses: Anchor[] }` — pulse = scale 1 -> 1.08 -> 1, 6 f.
8. **Countdown**, **Tally**, **Rail** — section 7.
9. **Chip** `{ text, dock | body:{x,y}, pin?: Pt, row?, rolls?: [{ at, text }], glyph?: [{ at, kind:"check"|"question" }], build?: [{ at, text }], protect?: Rect }`
   — pill h 56, radius 28, `cardFill`, 1 px `line` border, padding 0 22; 12 px `accent` dot, 12 px gap, text.
   `pin` adds a 10 px anchor ring (1.5 px white) on the slide point and a 1 px `text2` leader from the pill's nearest
   edge; the pill stays where `body`/`dock` puts it (screen space) while the leader follows the camera.
   `build` = the chip appears with a shorter text and grows on later words. `glyph check` = a 20 px check mark
   (2 px white stroke) drawn in 8 f after the text; `glyph question` = the check flips (rotateX 0 -> 90 -> 0, 8 f)
   into a "?" (Manrope 600, 28 px, `accent`).
10. **Ring** `{ c: Pt, rx, ry?, draw?: frames, pulses?: Anchor[], squeeze?: Anchor }` — SVG ellipse, 3 px accent +
    under-stroke, draws clockwise from 12 o'clock, then breathes.
11. **Brackets** `{ rect, pulses?: Anchor[], fadeTo?: [{ at, opacity }] }` — four white 2 px L-corners with 24 px
    arms (screen px) at the rect corners.
12. **Trace** `{ points?: Pt[], draw?: frames, cursor?: [f0, f1], headDot?: boolean, pulses?, style?: "accent"|"ghost" }`
    — `points`: Catmull-Rom path through the points, drawn over `draw` frames. `cursor`: LIVE pen: at frame f the
    path runs through the cursor samples of `spec/data/cursor-<id>.json` from f0 to min(f, f1) (drop repeated
    samples, 5-sample moving average, Catmull-Rom); after f1 it stays. `headDot` = 10 px white dot at the path's
    current end. `style:"ghost"` = 2 px white 72 %, dash 8 6 (used for the c3 displaced copy).
13. **CountTick** `{ n, at, pos: Pt, leaderTo: Pt }` — 40 px circle (screen px). Current: `accent` fill, numeral
    `graphite`. Previous: fill `dim(0.88)`, 1 px `accent` border, numeral white, 55 % opacity. 1 px `text2` leader
    from the circle's edge to `leaderTo`, drawn (6 f) when the matching Trace completes.
14. **Guide** `{ points: Pt[] }` — 2 px white 72 %, dash 8 6, draws in 12 f. Only used to CONNECT two marked objects
    (c1). Never as a midline or ruler.
15. **CursorHalo** `{ from, to }` — ring d 64 px (1.5 px accent) + 6 px accent dot, centred on the smoothed cursor
    (7-frame moving average of the deduplicated samples) + (5,7) slide px (the arrow's body), fades in/out over 6 f;
    hidden while the cursor is `null` for more than 10 f. It turns his real pointer into a visible instrument; it
    asserts nothing by itself.
16. **ScanLine** `{ from, dur, opacity?: 0.4 }` — 2 px accent horizontal line with a 60 px tail (accent 12 % -> 0)
    sweeping the stage top to bottom.
17. **Spotlight** `{ keep: Rect[], at, swap?: [{ at, keep }], until }` — `dim(0.65)` over the stage except the
    `keep` rects (slide space).
18. **Compare** (c1) `{ a: camera, b: camera, sweeps: [{ from, to, x0, x1 }], labels:[left,right] }` — two film
    layers; layer B is visible only left of a vertical 1 px white divider whose screen x follows `sweeps` (INOUT).
    Two mini pills (h 36, 22 px caps, `cardFill`) ride the divider top: `labels[0]` left of it, `labels[1]` right.
19. **EquationBar** (c5) `{ left, right, opAt, rightAt, qualifier:{ text, at }, strikeAt, questionAt, pulses }`
    — card x 60-940, height 124, top = stageBottom - 136, `cardFill`, 1 px border, radius 20. Row 1 (text centre
    y +38): `left`, 32 px caps +0.1em. Row 2 (centre y +88), left to right with 16 px gaps: qualifier pill (h 40,
    22 px caps, 10 px accent dot; inserted at `qualifier.at`, pushing the rest right over 12 f INOUT), operator
    (44x44 SVG "=": two 4 px white bars), `right` (32 px caps; letter-wipe reveal), "?" (accent, POP at
    `questionAt`). `strikeAt`: a 4 px accent diagonal draws through the "=" in 8 f (it becomes a not-equal sign).
    **The strike is only allowed if the qualifier pill is already on screen.**
20. **JoinBlink** — automatic (section 3.3).
21. **PropCard** `{ dock, size: 180, label?, rolls? }` — inset card (`graphite2`, 1 px border, radius 20,
    180x180; with a label strip it is 180x216, label 24 px caps `text2`) holding the cut's Prop at 132-150 px.
22. **Prop** — the ONE custom component of each cut. 2 px white SVG strokes, one `accent` detail, transparent fill.
    Three placements: `token` (84 px in the kicker row, 48 px in the HUD), `card` (inside a PropCard), `film`
    (in screen space over the stage, >= 130 px). Each prop has named moves the storyboard triggers on words:

| Cut | Component | Drawing | Moves |
|---|---|---|---|
| c1 | `CoinProp` | disc: circle r 0.46 + inner rim circle r 0.36, 30 deg accent arc on the rim. No lettering, no value | `flip` (rotateY +180 or +540), `edge` (rotateY 0 -> 90: ends as a 3 px vertical line), `face` (back to 0), `fly` (travel to a slide point and cross-fade into a Ring) |
| c2 | `BombomProp` | wrapped candy: ellipse body + two wrapper fans with 2 pleat lines each; accent dot on the body | `twist` (rotate -12 -> +8 -> 0 deg, 14 f), `spin` (360 deg, 12 f), `sparkle` (4-point stroke drawn beside it, 10 f), `rock` (+-4 deg loop, 40 f) |
| c3 | `TracheaPush` | token: vertical tube (two lines 0.28 apart) with five C-ring arcs, top ring accent. Film mode: three ">" chevrons, 44 px tall, 3 px accent with under-stroke | `pulse` (token scale 1 -> 1.1 -> 1), `push` (chevrons travel along a given slide-space segment/polyline, 4 f stagger, 10 f per pass), `lean` (token rotate 0 -> 6 -> 0 deg) |
| c4 | `LaudoSheet` | sheet 0.62 x 0.8 with folded corner + three text lines; accent caret | `write` (outline 10 f, then lines 4 f each), `erase` (lines un-draw right to left, 4 f each, 3 f stagger; caret starts blinking, 15 f period) |
| c5 | `RibArc` | one stroke morphing between curved `M .1 .65 Q .5 .05 .9 .65` and flat `M .1 .5 Q .5 .5 .9 .5`; accent dot on its left end; when flat, a 30 % dashed ghost of the curved state stays | `flatten` (14 f), `curve` (14 f), `loop` (flatten/curve, 40 f) |
| c6 | `SkinFold` | three stacked wavy crease strokes | `draw` (14 f), `squish` (scaleY 1 -> 0.7 -> 1, 10 f), `multiply` (becomes three stacked soft rolls, 5 f stagger) |

23. **AnswerField** (c6) `{ dock, at }` — dashed 1 px `text2` pill 420x72 (radius 36) with a 2 px accent caret
    blinking (15 f period) at its left padding. No text inside.
24. **EndQuestion**, **ClosingLockup** — section 10.

---

## 9. HOOK template (frame 0 to H; H = `hook.exit`, 96-104)

Speech and picture start at frame 0. State = HOOK (kicker row, headline zone, SLOT stage, caption band live).

| Frame | Beat |
|---|---|
| 0 (poster frame) | kicker row on: token 84 px at (60,240) + kicker "TÓRAX PEDIÁTRICO". Headline line 1 fully on. Slot already shows the hook crop; the crop pushes in (camera s x 1.00 -> x 1.05 linearly from 0 to H). Bubble and captions live. If a countdown is armed at 0 (c2) it is already ticking in the readout position. |
| 3, 6 | headline lines 2 and 3 slam. Headline complete by f 11. |
| word frames | verbatim headlines (`quoted: true` with `wordSync`): each word punches on its spoken frame. |
| `accentAt` (the accent word's spoken frame, or f 10 when it is not spoken in the hook) | accent sweep on the accent word/line (8 f); the token plays its move; **tick**. |
| per storyboard | hook-only elements in the slot (rings, trace, first chip). |
| H .. H+14 | headline collapses into the HUD tag; kicker text fades out (6 f); token 84 -> 48 px. |
| H .. H+16 | stage top edge 716 -> 360 (OUT); camera interpolates from the hook crop to the first body camera (INOUT, same 16 f). **Whoosh** at H+2. |
| H+10 .. H+20 | rail draws in. |

Headline rules: 2-3 lines (4 allowed only for the c1 end quote), max 16 characters per line at 84 px / 14 at
96-104 px, one accent word or line, never over the film. Verbatim headlines carry typographic quotes so they read
as his words, not as a claim by the advertiser.

---

## 10. CLOSING template

T = `frames` (first frame after the speech). The closing has a PRE-ROLL inside the speech (variant A) or starts at
T (variant B), then 102 frames after T. C = frame - T.

### 10.1 Variant A — the doctor SPEAKS the end line (c1, c2, c4, c6)
P = `closing.preRoll` (about 16 f before the first word of his last sentence; given per cut).

| Frame | Beat |
|---|---|
| P .. P+8 | HUD tag, readout and rail fade out. |
| P .. P+16 | stage top edge 360 -> 716 (INOUT); camera -> `closing.slotCam`; kicker row returns (token 48 -> 84 px, kicker text fades in over the last 8 f). Elements with `until:"closing"` exit (6 f). |
| P+16 .. T | captions hidden. **EndQuestion**: the end line is laid out in the headline zone exactly like a hook headline (same x, y, size rules; layout precomputed, no reflow) and each word appears on its own spoken frame (translateY 24 -> 0, opacity 0 -> 1, 5 f, OUT). The accent word sweeps to `accent` on its frame. |

### 10.2 Variant B — neutral question, not spoken (c3, c5)
| Frame | Beat |
|---|---|
| T .. T+8 | HUD tag, readout, rail fade out; captions gone. |
| T .. T+16 | stage top edge 360 -> 716; camera -> `closing.slotCam`; kicker row returns. |
| T+4, T+7, T+10 | question lines slam (hook slam). Accent sweep at T+12. |

### 10.3 Common, after T (both variants)

| C | Beat |
|---|---|
| 0 | stage video frozen (section 3.2); bubble frozen. Audio ends. |
| 0 .. 12 | film brightness 1 -> 0.55 (`filter: grayscale(1) brightness(.55)`); every annotation not listed in `closing.keep` fades (6 f). Kept marks keep breathing. |
| 8 | PROP callback in the kicker row (token plays `closing.propMove`); **pop**. |
| 10 .. 26 | stage bottom edge 1210 -> 1052 (INOUT); docked items ride the edge up. |
| 14 .. 22 | CTA line in Zcta, left x 60: line 1 `A resposta está` (C14-20), line 2 `na aula completa.` (C17-23); cap-top of line 1 at y 1088, pitch 70. |
| 23 .. 31 | accent sweep on `aula completa`. |
| 26 .. 48 | LOCKUP in the caption band, right of the bubble (x 300-956), replacing caption and name tag: `Nome do Apresentador` (40 px, box y 1250-1298, C26-32); lesson name `Nome da aula` / `e segmentação pulmonar` (30 px 400, box y 1306-1378, C30-36); pill (x 300, y 1392-1456, h 64, radius 32, `accentGrad`) grows from a 64 px circle to its full width (text width + 64) C34-44, text `ASSISTA À AULA COMPLETA` fades in C40-46 (pill width about 590 px; it must end at x <= 956); logo `public/brand/logo-marca-branco.png` (538x100, Marca wordmark; the antigo logo is no longer used, client decision 2026-11-13) at height 36 (width 194), right-aligned at x 956 on the NAME row (y 1256-1292), fades in C40-48. |
| 48 .. 102 | hold. Slot camera keeps drifting (s x 1.03 over the hold); kept marks breathe; token idles; the pill's leading dot pulses every 30 f. |

Last frame vs first frame: kicker row, headline position and slot top edge are identical to frame 0, so the Reel
loops without a layout jump (c1's closing headline is literally the hook headline).

Reading time check (floors): end question on screen >= 1.8 s before T+102 in every cut; CTA line settled at C31,
held 71 f = 2.4 s; lockup settled at C48, held 1.8 s (the lesson name is a secondary label and is also in the ad copy).

---

## 11. Sound cues (optional, subtle; everything must read with the sound off)

Synthesise once with ffmpeg into `public/sfx/` (no downloads, no music). Speech is mastered to -14 LUFS; every cue
sits at least 16 dB below it. Never more than one cue in any 20-frame window (skip the later one).

| Cue | Recipe | Used for |
|---|---|---|
| `tick.wav` | `ffmpeg -f lavfi -i "sine=f=1400:d=0.03" -af "afade=t=out:st=0.005:d=0.025,volume=-22dB"` | countdown last 3 s; first chip of a series; CountTick 1, 3 and 8 only; accent sweep in the hook |
| `pop.wav` | `ffmpeg -f lavfi -i "sine=f=520:d=0.07" -af "asetrate=44100*1.25,aresample=44100,afade=t=out:st=0.02:d=0.05,volume=-20dB"` | countdown zero; prop landing; closing prop callback |
| `whoosh.wav` | `ffmpeg -f lavfi -i "anoisesrc=c=pink:d=0.22" -af "bandpass=f=900:w=600,afade=t=in:d=0.08,afade=t=out:st=0.08:d=0.14,volume=-24dB"` | stage open / close; JoinBlink at -6 dB more |

---

## 12. Storyboard file (data for ONE generic composition)

- Composition id `AulaCut` (`motion/src/aula/AulaCut.tsx`), registered in `src/Root.tsx` once per
  storyboard with `calculateMetadata` -> `durationInFrames = frames + 102`, 1080x1920, 30 fps.
- Storyboards: `motion/src/storyboards/<id>.json` (PRIMARY) and `<id>.alt.json` (ALT, `ALT.md`).
- Each cut = this JSON + at most one custom component (its Prop, section 8.22).
- The `.md` storyboards in this folder are the source of truth for the values; transcribe them into JSON.

```ts
// JSON schema, written as TypeScript for readability. All coordinates: slide space unless marked "screen".
type Anchor = { w: string; n: number; off?: number; f: number }   // word, occurrence (1-based), offset, expected frame
            | { f: number };                                        // absolute frame (joins, closing)
type Cam    = { cx: number; cy: number; s: number } | { pin: [number, number]; at: [number, number]; s: number };
type Rect   = [number, number, number, number];                     // x0,y0,x1,y1
type Pt     = [number, number];
type Until  = Anchor | "closing" | "end";

interface Storyboard {
  id: "c1" | "c2" | "c3" | "c4" | "c5" | "c6";
  format: "primary" | "alt";
  video: string;                 // "c1/video.mp4" (staticFile)
  data: string;                  // "c1.json"  (src/data) -> palavras, segmentos, frames
  cursor: string;                // "cursor-c1.json" (copy spec/data/* to src/data/)
  frames: number;                // speech length T (must equal data.frames)
  closingFrames: 102;
  freezeStageAt?: number;        // c3: 1084
  films: { id: string; rect: Rect; from?: number; to?: number }[];   // from/to = frame range (c3 slide change)
  covers?: { rect: Rect; label: string; at: Anchor; shakes?: Anchor[] }[];
  patches?: { rect: Rect; fill: "stage" | "filmBlack" }[];
  face: { still: number };       // keys and lost intervals come from face.json[id]
  prop: { component: string };   // CoinProp | BombomProp | TracheaPush | LaudoSheet | RibArc | SkinFold
  hook: {
    kicker: string; lines: string[]; accent: string; quoted: boolean; size: number;
    wordSync?: { anchor: Anchor; line: number; word: number }[];
    accentAt: Anchor; tokenFrom?: Anchor; tokenMove?: string;
    exit: number;                                   // H
    slot: { cam?: [Cam, Cam]; panes?: { rect: Rect /*screen x,y,w,h*/; films: string[]; cam: [Cam, Cam] }[] };
  };
  hud: {
    tag: string[]; sub?: { text: string; at: Anchor };
    readouts: (
      | { type: "countdown"; label: string; arm: Anchor; target: Anchor; zeroTag: string; clear?: Anchor }
      | { type: "tally"; label: string; items: Anchor[]; clear?: Anchor }
    )[];
  };
  camera: { at: Anchor; to: Cam; dur: number; cut?: boolean; punch?: boolean }[];
  beats: { id: string; el: string; at: Anchor; until?: Until; props: Record<string, unknown> }[];
  captions: { hide: [number, number][]; accent: Anchor[]; emphasis: Anchor[] };
  closing: {
    variant: "A" | "B"; preRoll?: number;           // P (variant A)
    lines: string[]; accent: string; size: number; quoted?: boolean;
    wordSync?: { anchor: Anchor; line: number; word: number }[];
    swapTo?: { lines: string[]; accent: string; size: number };   // c1: quote -> hook headline at C4..C18
    slotCam: Cam; keep: string[];                   // beat ids kept after T
    propMove: string; faceStill?: number;
  };
}
```

Resolution rules for the composition:
- `Anchor{w,n}` -> index of the n-th entry of `palavras` whose `w === anchor.w` (exact string, punctuation
  included) -> `Math.round(s * 30) + (off ?? 0)`; assert `|resolved - f| <= 1`.
- Beats are rendered in array order (later = on top). Z-order of layers, bottom to top: background, stage (video,
  patches, covers, SVG marks, screen-space chips/numerals/props, ScanLine, Spotlight, JoinBlink), HUD / headline,
  CTA, caption band (bubble, captions, lockup).
- `until` defaults: Chip/Ring/Brackets/Trace/CountTick/PropCard -> `"closing"`; ScanLine/CursorHalo have their own
  duration.

Minimal example (one beat of c1):
```json
{ "id": "ringA", "el": "Ring",
  "at": { "w": "metálico,", "n": 1, "off": 34, "f": 196 },
  "until": "end",
  "props": { "c": [250, 46], "rx": 38, "draw": 0,
             "pulses": [ { "w": "radiopaco,", "n": 1, "f": 251 }, { "w": "aqui,", "n": 1, "f": 381 } ] } }
```

---

## 13. QA before the final render (blocking)

1. Export one annotated still per beat group (a "still sheet" per cut) and get the presenter's sign-off on every mark
   that touches anatomy. Without sign-off, remove the mark and keep the docked chip.
2. Listen to any transcript word you are not sure of before it becomes big type.
   a esquerda você acha que é normal" and "Chama atenção alguma coisa?"; c6 "raio X,". Fix `palavras[].w` if wrong.
3. c3: scrub frames 1080-1200 of the render: the word "NEUROBLASTOMA" must never appear (stage frozen at 1084).
4. c1: scrub the whole render: no pixel of the two profile films may be visible. c6: no slide text, no baby photo.
   c5: no stamp. c2: no "P#55 / LLH".
5. Phone test at real size: countdown digits, chips and captions readable; bubble shows his face (check the
   face-lost intervals); nothing readable in y < 220, y > 1500, x > 960.
6. Typecheck (`npm run typecheck`) and render each cut once at full length; total length must be speech + 3.4 s.
