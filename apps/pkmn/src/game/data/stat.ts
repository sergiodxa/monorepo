/**
 * Centralizes the stat identifiers used by the game data layer and provides the
 * canonical set of keys for referencing per-stat values consistently.
 *
 * This module defines the shared stat enum and the corresponding mapped shape
 * for complete stat collections, so other modules can depend on a single source
 * of truth when reading, storing, or transforming stat data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Base stats of the species */
export enum Stat {
	HP = "hp",
	Attack = "attack",
	Defense = "defense",
	SpecialAttack = "special-attack",
	SpecialDefense = "special-defense",
	Speed = "speed",
}

export type StatSet = Record<Stat, number>;
