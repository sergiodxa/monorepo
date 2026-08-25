/**
 * Centralizes the type taxonomy and effectiveness primitives used by the
 * game data layer: elemental category identifiers, numeric effectiveness
 * values, and the generic matchup shape for mapping relationships between
 * them.
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
