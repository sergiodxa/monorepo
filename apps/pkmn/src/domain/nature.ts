import { Stat } from "./stat";

export interface Nature {
	increases: Stat | null;
	decreases: Stat | null;
}

export namespace Nature {
	/** String identifier of a nature in loaded game data. */
	export type Symbol = string;
}
