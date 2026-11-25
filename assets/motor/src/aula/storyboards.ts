// Storyboard list -> composition ids ("rp-" + storyboard id). ENGINE-OWNED.
// Cut authors only edit src/storyboards/<id>.json; the ALT author registers through src/aula/alt/register.tsx.
import type { Storyboard } from "./types";
import c1 from "../storyboards/c1.json";
import c2 from "../storyboards/c2.json";
import c3 from "../storyboards/c3.json";
import c4 from "../storyboards/c4.json";
import c5 from "../storyboards/c5.json";
import c6 from "../storyboards/c6.json";
import labA from "../storyboards/lab-a.json";
import labB from "../storyboards/lab-b.json";

const all = [c1, c2, c3, c4, c5, c6, labA, labB] as unknown as Storyboard[];

/** rp-c1 .. rp-c6, rp-lab-a, rp-lab-b */
export const AULAS: { id: string; storyboard: Storyboard }[] = all.map((sb) => ({ id: `rp-${sb.id}`, storyboard: sb }));

/** LOOK pilots (ENGINE.md "Looks"): the SAME storyboard and cut module rendered with a look of look.ts, under a new
 *  composition id "rp-<storyboard id>-<look id>". The plain ids above never change. */
const pilot = (sb: unknown, look: string) => {
  const storyboard = sb as Storyboard;
  return { id: `rp-${storyboard.id}-${look}`, storyboard, look };
};
export const AULA_LOOKS: { id: string; storyboard: Storyboard; look: string }[] = [
  pilot(c1, "branco"), pilot(c2, "tela-cheia"), pilot(c3, "azul-claro"), pilot(c5, "duas-cores"), pilot(c6, "azul-bebe"),
];
