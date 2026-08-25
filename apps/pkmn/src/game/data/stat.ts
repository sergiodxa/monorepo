/**
 * Centralizes the stat identifiers used by the game data layer, giving
 * other modules one canonical set of keys for per-stat values.
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
