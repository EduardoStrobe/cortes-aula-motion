// Resolve every storyboard without rendering and print what the engine decided: caption units, sound cues, camera
// keys / punches. Engine debugging aid.   Run:  node scripts/dump.mjs [c1 c2 ...] [--units] [--cues] [--cam]
import { AULAS } from "../src/aula/storyboards";
import { resolveStoryboard } from "../src/aula/resolve";

const args = process.argv.slice(2);
const want = args.filter((a) => !a.startsWith("--"));
const all = !args.some((a) => a.startsWith("--"));
const on = (k: string) => all || args.includes(`--${k}`);

for (const { storyboard: sb } of AULAS) {
  const id = sb.id;
  if (id.startsWith("lab")) continue;
  if (want.length && !want.includes(id)) continue;
  const r = resolveStoryboard(sb);
  const pal = r.data.palavras;
  const sf = (i: number) => Math.round(pal[i].s * 30);
  const ef = (i: number) => Math.round(pal[i].e * 30);
  console.log(`\n=== ${id}  T ${r.T}  H ${r.H}  P ${r.P}  joins ${r.joins.join(",")}`);
  if (on("units")) {
    const g = r.captionGroups;
    const rows = g.map((u, k) => {
      const next = k + 1 < g.length ? sf(g[k + 1][0]) : r.T;
      const dur = next - sf(u[0]);
      const lead = u.length > 1 ? Math.max(...u.slice(1).map((i) => sf(i) - sf(u[0]))) : 0;
      return `${sf(u[0])}-${ef(u[u.length - 1])} [${dur}f${dur < 8 ? " SHORT" : ""}${lead > 8 ? ` LEAD${lead}` : ""}] ${u.map((i) => pal[i].w).join(" ")}`;
    });
    console.log(rows.join("\n"));
  }
  if (on("cues")) {
    console.log("cues   :", r.cues.map((c) => `${c.f}:${c.cue}${c.gainDb ? `(${c.gainDb})` : ""}`).join(" "));
    console.log("skipped:", r.cuesSkipped.map((c) => `${c.f}:${c.cue}[${c.src}]`).join(" "));
  }
  if (on("cam")) {
    console.log("keys   :", r.camKeys.map((k) => `${k.f}+${k.dur}${k.ease === "inout" ? "" : k.ease}`).join(" "));
    console.log("punches:", r.punches.map((p) => `${p.f}${p.auto ? "a" : ""}`).join(" "));
    console.log("beats  :", r.beats.map((b) => `${b.id}@${b.at}`).join(" "));
  }
}
