/**
 * Data contract for nature records used by the game data layer.
 *
 * Centralizes the identifiers and stat-adjustment shape so other modules
 * depend on one explicit representation of nature data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Stat } from "./stat";

/** String identifier of a nature in loaded game data. */
export type NatureId = string;

/** Stat modifiers applied by a nature, or `null` for neutral natures. */
export interface Nature {
	increases: Stat | null;
	decreases: Stat | null;
}
