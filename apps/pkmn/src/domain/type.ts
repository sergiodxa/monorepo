/** Type of a creature or move */
export enum Type {
	BUG,
	DARK,
	DRAGON,
	ELECTRIC,
	FAIRY,
	FIGHTING,
	FIRE,
	FLYING,
	GHOST,
	GRASS,
	GROUND,
	ICE,
	NORMAL,
	POISON,
	PSYCHIC,
	ROCK,
	STEEL,
	WATER,
}

export enum Effectiveness {
	ZERO = 0,
	WEAK = 0.5,
	NORMAL = 1,
	SUPER = 2,
	HYPER = 4,
}

export type Matchup = {
	[key in Type]: {
		[key in Type]?: Effectiveness;
	};
};
