import { Stat } from "./stat";

/** String identifier of a nature in loaded game data. */
export type NatureId = string;

export interface Nature {
	increases: Stat | null;
	decreases: Stat | null;
}
