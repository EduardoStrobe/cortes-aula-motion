// LOOKS (ENGINE.md, section "Looks"). ENGINE-OWNED.
// A look = a colour theme + layout options applied to the SAME storyboard and cut module. The composition picks it
// (`<AulaCut storyboard look="branco">`, ids `rp-c1-branco` ...); without one the "default" look renders the
// approved output unchanged. Colours come in three groups:
//   page inks   (`Ink`)  everything OUTSIDE the stage: kicker, HUD, headline, captions, CTA, lockup, name tag, token.
//                        Chosen by the screen y of the element (`inkAt`), so a split background works.
//   on-film     (`film`) everything INSIDE the stage reads the live `C` / `dim()` tokens (tokens.ts). Dark by default
//                        in every look: the radiograph is a dark picture on any page colour.
//   chrome               stage card (border / shadow), camera block, logo variant, badge.
// Allowed colours (client-approved palette): the tokens of tokens.ts, #3C3C3C, #6E6E6E, #E3E3E3, #F4FCFE, #DCEEFC,
// #C6E2FA, #BFE0FB, #A5D2F7 and graphite / black / white alphas. Nothing else.
import { C_DEFAULT, H, Z, type FilmPalette } from "./tokens";
import type { Beat, Storyboard } from "./types";

/** How an ACCENT WORD is drawn: recoloured, or on a rounded tab (blue on blue fails; so does blue on white for
 *  small type). */
export type AccentWord = { mode: "colour"; color: string } | { mode: "tab"; fill: string; text: string };

export interface Ink {
  /** titles, captions, numerals */
  text: string;
  /** labels, kicker, lesson name, sub lines */
  text2: string;
  /** hairlines on the page (rail track) */
  line: string;
  /** typographic quotes of a verbatim headline */
  quote: string;
  /** NON-text accent marks on the page (dots, zero-tag dot) */
  mark: string;
  /** CSS background of the rail's progress fill */
  railFill: string;
  /** accent word of the hook / closing headline */
  head: AccentWord;
  /** accent word of a caption and "aula completa" in the CTA line */
  word: AccentWord;
  /** countdown digits in the last 3 s */
  digits: string;
  /** type set ON a block filled with `text` (the filled hook pill) */
  onText: string;
  /** opacity of a caption word that has not been spoken yet (the unit's later words) */
  capDim: number;
  /** silence dots of the caption band */
  dots: string;
  /** stroke colours handed to the cut's Prop in "token" placement (undefined = the Prop's own defaults) */
  token?: { color: string; accent: string };
  /** CTA pill of the lockup */
  pill: { fill: string; text: string };
  /** logo file ("branco" = white wordmark, "claro" = the dark-on-light wordmark) and whether it sits on a white card */
  logo: { file: "branco" | "claro"; card: boolean };
  /** camera block: CSS border (null = none) and box-shadow (null = none) */
  cam: { border: string | null; shadow: string | null };
  nameTag: string;
}

/** A stage box, screen px. */
export interface Box { x0: number; x1: number; top: number; bottom: number }
/** The four states of the stage: hook (0..H), body (H+16..P), close (P+16..T+10), end (T+26..). */
export interface StageGeom { hook: Box; body: Box; close: Box; end: Box }

/** "tela-cheia": the picture is not clipped to the stage box; graphite scrims keep type readable. All y in px. */
export interface Bleed {
  /** graphite alpha of the top plateau and of the band behind the hook headline (>= 0.86 keeps white, text2 and
   *  the accent at >= 4.5 : 1 over a pure white film) */
  alpha: number;
  /** the top scrim holds `alpha` from y 0 to this y, then fades to 0 over `topFade` px */
  hookTop: number; bodyTop: number; closeTop: number; topFade: number;
  /** bottom scrim in the body / pre-roll: 0 at [0], solid graphite from [1] down */
  bodyBottom: [number, number];
  /** bottom scrim after T + 10 (the CTA line needs the band from y 1068) */
  endBottom: [number, number];
  /** bottom scrim in the hook: 0 at headlineTop - hookLead, `alpha` at headlineTop - 24, solid from
   *  max(hookSolid, headlineBottom + 20) */
  hookLead: number; hookSolid: number;
}

export interface Layout {
  /** (a) series badge ("CASO 0N", or storyboard hook.badge) at the start of the kicker row */
  badge: boolean;
  /** stage boxes; the camera is transplanted from the reference geometry (see timeline.ts) */
  stage: StageGeom;
  /** (b) full-bleed picture */
  bleed: Bleed | null;
  /** hook headline: left x and cap-top of line 0, or `bottom` = baseline of the LAST line (wins over capTop);
   *  `clip` = paint it only above the stage's top edge (the default arrangement, headline over the stage) */
  headline: { x: number; capTop: number; bottom: number | null; maxWidth: number; clip: boolean };
  /** false = no captions before H (looks whose hook headline sits in the caption band) */
  hookCaptions: boolean;
  /** (d) camera block during the hook (it travels to Z.cam over H .. H + 18); null = always Z.cam */
  hookCam: { x: number; y: number; w: number; h: number; radius: number } | null;
  /** Marca wordmark during the hook (out with the kicker): `x` = left edge (align "left") or right edge
   *  (align "right") of the ART, `cy` = its vertical centre, `h` = art height; null = none */
  hookLogo: { x: number; cy: number; h: number; align: "left" | "right" } | null;
  /** [leva 6, client: "remover essas infos extras e focar na headline; Marca apenas no final"] true = no kicker
   *  row at all (prop token, series badge, kicker text) and no prop token in the HUD row */
  clean: boolean;
}

export interface Look {
  id: string;
  /** page background: flat fallback colour, CSS gradient, and whether the drifting radial light is drawn */
  bg: { color: string; css: string; light: boolean };
  /** (c) "duas-cores": everything below `y` is a second surface with its own background and ink */
  split: { y: number; css: string; ink: Ink } | null;
  /** page ink (above the split when there is one) */
  ink: Ink;
  /** stage card: background (null = C.graphite2), border CSS (undefined = the default 1 px line, null = none),
   *  box-shadow (null = none) */
  stage: { bg: string | null; border?: string | null; shadow: string | null };
  /** on-film palette overrides (null = the default dark palette) */
  film: FilmPalette | null;
  /** series badge */
  badge: { fill: string; text: string };
  layout: Layout;
}

// ---- inks ---------------------------------------------------------------------------------------------------------
const G = C_DEFAULT.graphite;
const A = C_DEFAULT.accent;

/** The approved dark page (leva 4). Every value equals what the components used before looks existed. */
const DARK: Ink = {
  text: C_DEFAULT.white, text2: C_DEFAULT.text2, line: C_DEFAULT.line, quote: C_DEFAULT.text2, mark: A,
  railFill: C_DEFAULT.accentGrad, head: { mode: "colour", color: A }, word: { mode: "colour", color: A }, digits: A,
  capDim: 0.45, dots: C_DEFAULT.text2, onText: G,
  pill: { fill: C_DEFAULT.accentGrad, text: G }, logo: { file: "branco", card: false },
  cam: { border: `1px solid ${C_DEFAULT.line}`, shadow: null }, nameTag: C_DEFAULT.text2,
};
/** Dark page of the pilots: an unspoken caption word at 0.45 measures 4.4 : 1 on graphite; 0.5 gives 5.1 : 1. */
const DARK_PILOT: Ink = { ...DARK, capDim: 0.5 };
/** White page (c1). #60AFF0 on white is 2.4 : 1: the big headline word keeps the colour the client approved in the
 *  mockup, every smaller accent word goes on an accent tab with graphite text (7.1 : 1), countdown digits stay
 *  in the text colour. */
const WHITE: Ink = {
  text: "#3C3C3C", text2: "#6E6E6E", line: "#E3E3E3", quote: "#6E6E6E", mark: A, railFill: C_DEFAULT.accentGrad,
  head: { mode: "colour", color: A }, word: { mode: "tab", fill: A, text: G }, digits: "#3C3C3C", capDim: 0.74,
  dots: "#6E6E6E", onText: C_DEFAULT.white, token: { color: "#3C3C3C", accent: A },
  pill: { fill: C_DEFAULT.accentGrad, text: G }, logo: { file: "claro", card: false },
  cam: { border: "1px solid #E3E3E3", shadow: "0 16px 40px rgba(28,30,34,0.12)" }, nameTag: "#6E6E6E",
};
/** Blue page (c3 light blue, c6 / lower half of c5 baby blue). Blue on blue fails: the accent word is a graphite tab
 *  with `tabText`, non-text accents are graphite. */
const blueInk = (tabText: string): Ink => ({
  text: G, text2: "#3C3C3C", line: "rgba(28,30,34,0.16)", quote: G, mark: G, railFill: G,
  head: { mode: "tab", fill: G, text: tabText }, word: { mode: "tab", fill: G, text: tabText }, digits: G,
  capDim: 0.7, dots: "#3C3C3C", onText: C_DEFAULT.white, token: { color: G, accent: C_DEFAULT.accent2 },
  pill: { fill: G, text: C_DEFAULT.white }, logo: { file: "claro", card: true },
  cam: { border: null, shadow: "0 16px 40px rgba(28,30,34,0.14)" }, nameTag: G,
});

// ---- layout ---------------------------------------------------------------------------------------------------------
const S = Z.stage;
/** The reference geometry = the approved layout. Storyboard cameras, panes and pins are authored for it. */
export const REF_GEOM: StageGeom = {
  hook: { x0: S.x0, x1: S.x1, top: S.slotTop, bottom: S.bottom },
  body: { x0: S.x0, x1: S.x1, top: S.bodyTop, bottom: S.bottom },
  close: { x0: S.x0, x1: S.x1, top: S.slotTop, bottom: S.bottom },
  end: { x0: S.x0, x1: S.x1, top: S.slotTop, bottom: S.endBottom },
};
export const REF_W = S.w;
/** leva 6: pilots without the kicker row: headline from y 250, hook stage 106 px taller */
const cleanLayout = (): Layout => ({
  ...BASE_LAYOUT, clean: true,
  stage: { ...REF_GEOM, hook: { ...REF_GEOM.hook, top: REF_GEOM.hook.top - 106 } },
  headline: { ...BASE_LAYOUT.headline, capTop: Z.headline.capTop - 106 },
});
const BASE_LAYOUT: Layout = {
  badge: false, stage: REF_GEOM, bleed: null,
  headline: { x: Z.left, capTop: Z.headline.capTop, bottom: null, maxWidth: Z.headline.maxWidth, clip: true },
  hookCaptions: true, hookCam: null, hookLogo: null, clean: false,
};
/** Full-width window = the reference box scaled x 1.08 about its own centre (see ENGINE.md "tela-cheia"); the hook
 *  window sits higher because the headline covers the lower part of the picture. */
const wide = (b: Box, cy = (b.top + b.bottom) / 2): Box => {
  const h = ((b.bottom - b.top) * 1080) / REF_W;
  return { x0: 0, x1: 1080, top: cy - h / 2, bottom: cy + h / 2 };
};
const BLEED_GEOM: StageGeom = {
  hook: wide(REF_GEOM.hook, 640), body: wide(REF_GEOM.body), close: wide(REF_GEOM.close), end: wide(REF_GEOM.end),
};
// (leva 6: the hook wordmark is gone; Marca only in the closing lockup)
export const TOP_RIGHT_LOGO = { x: Z.safeRight, cy: Z.kickerCy, h: 40, align: "right" as const };

// ---- the looks ------------------------------------------------------------------------------------------------------
const stageDefault = { bg: null, shadow: null };
const BADGE = { fill: A, text: G };

export const LOOKS: Record<string, Look> = {
  default: {
    id: "default", bg: { color: G, css: C_DEFAULT.bg, light: true }, split: null, ink: DARK, stage: stageDefault,
    film: null, badge: BADGE, layout: BASE_LAYOUT,
  },
  // c1: white page, stage as a card with a soft shadow, dark-on-light wordmark top right during the hook
  branco: {
    id: "branco", bg: { color: "#FFFFFF", css: "linear-gradient(160deg, #FFFFFF 0%, #F4FCFE 100%)", light: false },
    split: null, ink: WHITE, stage: { bg: null, border: null, shadow: "0 24px 60px rgba(28,30,34,0.18)" },
    film: null, badge: BADGE, layout: { ...BASE_LAYOUT, clean: true },
  },
  // c2: the radiograph fills the frame behind graphite scrims; headline over the lower part of the picture
  "tela-cheia": {
    id: "tela-cheia", bg: { color: G, css: C_DEFAULT.bg, light: true }, split: null, ink: DARK_PILOT,
    stage: { bg: "transparent", border: null, shadow: null }, film: null, badge: BADGE,
    layout: {
      ...BASE_LAYOUT, clean: true, stage: BLEED_GEOM,
      bleed: {
        alpha: 0.9, hookTop: 320, bodyTop: 350, closeTop: 706, topFade: 200,
        bodyBottom: [1170, 1262], endBottom: [960, 1066], hookLead: 180, hookSolid: 1250,
      },
      headline: { ...BASE_LAYOUT.headline, bottom: 1226, clip: false },
    },
  },
  // c3: light blue page, dark type, accent word on a graphite tab, wordmark on a white card
  "azul-claro": {
    id: "azul-claro", bg: { color: "#DCEEFC", css: "linear-gradient(160deg, #DCEEFC 0%, #C6E2FA 100%)", light: false },
    split: null, ink: blueInk("#DCEEFC"), stage: { bg: null, border: null, shadow: "0 24px 60px rgba(28,30,34,0.18)" },
    film: null, badge: BADGE, layout: cleanLayout(),
  },
  // c5: top 52 % graphite (as approved), bottom 48 % baby blue with dark type; the stage straddles the split
  "duas-cores": {
    id: "duas-cores", bg: { color: G, css: C_DEFAULT.bg, light: true },
    split: { y: Math.round(H * 0.52), css: "linear-gradient(180deg, #BFE0FB 0%, #A5D2F7 100%)", ink: blueInk("#BFE0FB") },
    ink: DARK_PILOT, stage: { bg: null, border: null, shadow: "0 24px 60px rgba(28,30,34,0.35)" },
    film: null, badge: BADGE, layout: cleanLayout(),
  },
  // c6: baby blue page; hook = camera block large on top, quote under it, radiograph small; then the usual layout
  "azul-bebe": {
    id: "azul-bebe", bg: { color: "#BFE0FB", css: "linear-gradient(160deg, #BFE0FB 0%, #A5D2F7 100%)", light: false },
    split: null, ink: blueInk("#BFE0FB"), stage: { bg: null, border: null, shadow: "0 16px 40px rgba(28,30,34,0.16)" },
    film: null, badge: BADGE,
    // leva 6 (client: "deixar a imagem sempre em destaque em vez do rosto do apresentador"): no camera-on-top hook
    layout: cleanLayout(),
  },
};
export const LOOK_IDS = Object.keys(LOOKS);
export const DEFAULT_LOOK = LOOKS.default;

/** Ink of the surface at screen y (the lower surface of a split look below its line). */
export const inkAt = (look: Look, y: number): Ink => (look.split && y >= look.split.y ? look.split.ink : look.ink);
/** true when the look's stage boxes are the reference ones (PaneSplit hooks need that). */
export const isRefGeom = (look: Look): boolean => {
  const g = look.layout.stage;
  return (["hook", "body", "close", "end"] as const).every((k) =>
    g[k].x0 === REF_GEOM[k].x0 && g[k].x1 === REF_GEOM[k].x1 && g[k].top === REF_GEOM[k].top && g[k].bottom === REF_GEOM[k].bottom);
};

// ---- storyboard overrides -------------------------------------------------------------------------------------------
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
/** Deep merge of plain objects. Arrays and primitives REPLACE; `null` replaces (switches an option off). */
export const deepMerge = <T>(base: T, over: unknown): T => {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : over) as T;
  const out: Obj = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge((base as Obj)[k], over[k]);
  return out as T;
};

/** `storyboard.looks[<look id>]`: partial storyboard merged over the base one when that look renders, plus
 *    look        partial Look (theme and layout) merged over the look's definition
 *    patchBeats  { "<beat id>": { ...partial beat } | null }   (null removes the beat)
 *    addBeats    beats appended after the patched list
 *  Everything else is deep-merged into the storyboard (objects merge, ARRAYS REPLACE: `camera`, `lines`,
 *  `captions.hide`, `beats` ...). */
export interface LookOverride {
  look?: unknown;
  patchBeats?: Record<string, Partial<Beat> | null>;
  addBeats?: Beat[];
  [key: string]: unknown;
}

const merged = new WeakMap<Storyboard, Map<string, { sb: Storyboard; look: Look }>>();
/** The storyboard and the look that `lookId` renders (memoised; the default look returns `sb` itself). */
export const applyLook = (sb: Storyboard, lookId?: string | null): { sb: Storyboard; look: Look } => {
  const id = lookId ?? "default";
  const base = LOOKS[id];
  if (!base) throw new Error(`[aula] unknown look "${id}" (known: ${LOOK_IDS.join(", ")})`);
  const ov = sb.looks?.[id];
  if (!ov) return { sb, look: base };
  let m = merged.get(sb);
  if (!m) merged.set(sb, (m = new Map()));
  const hit = m.get(id);
  if (hit) return hit;
  const { look: lookOv, patchBeats, addBeats, ...rest } = ov;
  let eff = deepMerge(sb, rest);
  if (patchBeats || addBeats) {
    const ids = new Set(eff.beats.map((b) => b.id));
    for (const k of Object.keys(patchBeats ?? {})) {
      if (!ids.has(k)) throw new Error(`[aula] storyboard "${sb.id}" looks.${id}.patchBeats: no beat "${k}"`);
    }
    const beats = eff.beats
      .filter((b) => !(patchBeats && patchBeats[b.id] === null))
      .map((b) => (patchBeats && patchBeats[b.id] ? deepMerge(b, patchBeats[b.id]) : b));
    eff = { ...eff, beats: [...beats, ...(addBeats ?? [])] };
  }
  const out = { sb: eff, look: lookOv ? { ...deepMerge(base, lookOv), id } : base };
  m.set(id, out);
  return out;
};
