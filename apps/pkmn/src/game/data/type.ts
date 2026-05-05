/**
 * Centralizes the module-level type taxonomy and effectiveness primitives used by the
 * game data layer. It defines the canonical identifiers for elemental categories and
 * the numeric effectiveness values that other systems can reuse when expressing
 * interactions between typed entities.
 *
 * This module also provides the generic matchup shape for mapping relationships across
 * those identifiers in a consistent way. By keeping these shared data contracts in one
 * place, the rest of the codebase can depend on stable, content-agnostic structures for
 * type-based rules and lookups.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Type of a creature or move */
export enum Type {
	BUG = "bug",
	DARK = "dark",
	DRAGON = "dragon",
	ELECTRIC = "electric",
	FAIRY = "fairy",
	FIGHTING = "fighting",
	FIRE = "fire",
	FLYING = "flying",
	GHOST = "ghost",
	GRASS = "grass",
	GROUND = "ground",
	ICE = "ice",
	NORMAL = "normal",
	POISON = "poison",
	PSYCHIC = "psychic",
	ROCK = "rock",
	STEEL = "steel",
	WATER = "water",
}

export enum Effectiveness {
	ZERO = 0,
	QUARTER = 0.25,
	WEAK = 0.5,
	NORMAL = 1,
	SUPER = 2,
	HYPER = 4,
}

export type Matchup<T extends string | number | symbol> = {
	[key in T]: {
		[key in T]?: Effectiveness;
	};
};
