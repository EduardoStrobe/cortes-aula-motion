// Screen-group elements (HTML in screen space). OWNER: screen-group element author (add helpers/elements freely).
import type { ElementDef } from "../types";
import { AnswerField } from "./AnswerField";
import { Chip } from "./Chip";
import { CountTick } from "./CountTick";
import { EquationBar } from "./EquationBar";
import { Prop } from "./Prop";
import { PropCard } from "./PropCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const screenElements: Record<string, ElementDef<any>> = { Chip, CountTick, EquationBar, PropCard, Prop, AnswerField };
