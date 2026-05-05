/**
 * Defines the data contract for nature records used by the game data layer.
 * This module centralizes the identifiers and stat adjustment shape needed to
 * describe how a nature affects gameplay-relevant attributes.
 *
 * It exists as a small boundary between raw content and the rest of the game
 * systems, so other modules can depend on a stable, explicit representation for
 * nature data without coupling themselves to storage or loading details.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
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
