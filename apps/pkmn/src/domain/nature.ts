import { Stat } from "./stat";

/** String identifier of a nature in loaded game data. */
export type NatureId = string;

/** Stat modifiers applied by a nature, or `null` for neutral natures. */
export interface Nature {
	/** Increased stat, if this nature is not neutral. */
	increases: Stat | null;
	/** Decreased stat, if this nature is not neutral. */
	decreases: Stat | null;
}
