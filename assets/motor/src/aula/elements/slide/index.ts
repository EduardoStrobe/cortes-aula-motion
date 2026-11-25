// Slide-group elements (marks drawn through the camera). OWNER: slide-group element author.
import type { ElementDef } from "../types";
import { Brackets } from "./Brackets";
import { Compare } from "./Compare";
import { CursorHalo } from "./CursorHalo";
import { Guide } from "./Guide";
import { Ring } from "./Ring";
import { ScanLine } from "./ScanLine";
import { Spotlight } from "./Spotlight";
import { Trace } from "./Trace";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const slideElements: Record<string, ElementDef<any>> = { Ring, Brackets, Trace, Guide, CursorHalo, ScanLine, Spotlight, Compare };
