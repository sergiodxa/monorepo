/** Base stats of the species */
export enum Stat {
	HP,
	Attack,
	Defense,
	SpecialAttack,
	SpecialDefense,
	Speed,
}

export type StatSet = Record<Stat, number>;
