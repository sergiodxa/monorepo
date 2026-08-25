/**
 * Centralizes the durable status definitions used by this game data module.
 *
 * Keeps the canonical set of long-lived state markers in one place so
 * status data stays consistent wherever it is read, stored, or serialized.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/**
 * Persistent major status conditions that can remain on a creature outside
 * battle. String-valued so serialized state stays stable across reordering,
 * matching values used by move effects, medicines, and the capture bonus.
 */
export enum State {
	Burned = "burn",
	Paralyzed = "paralysis",
	Poisoned = "poison",
	Asleep = "sleep",
	Frozen = "freeze",
}
