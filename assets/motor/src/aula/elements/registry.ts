// Shared element registry: el name -> implementation. ENGINE-OWNED and FINAL: the two element groups only edit the
// files inside their own folder (elements/screen/*, elements/slide/*); each folder's index.ts lists its elements.
// Lookup order for a beat's `el`: this registry, then the cut module's `elements` map (src/aula/cuts/<id>.tsx).
import { Debug } from "./Debug";
import { screenElements } from "./screen";
import { slideElements } from "./slide";
import type { ElementDef } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REGISTRY: Record<string, ElementDef<any>> = { Debug, ...slideElements, ...screenElements };
