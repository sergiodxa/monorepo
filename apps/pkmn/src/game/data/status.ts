/**
 * Centralizes the durable status definitions used by this game data module.
 * It provides the canonical set of long-lived state markers that other parts of the codebase can reference without depending on presentation details or battle flow concerns.
 *
 * This module exists as a stable source of shared identifiers for persistent status state.
 * Keeping these values together helps preserve consistency anywhere status data is read, stored, compared, or serialized across the game domain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/**
 * Persistent major status conditions that can remain on a creature outside battle.
 *
 * String-valued so the stored/serialized state stays stable across reordering and
 * renders directly; the values match the status strings used by move effects,
 * medicines, and the capture bonus elsewhere in the engine.
 */
export enum State {
	Burned = "burn",
	Paralyzed = "paralysis",
	Poisoned = "poison",
	Asleep = "sleep",
	Frozen = "freeze",
}
