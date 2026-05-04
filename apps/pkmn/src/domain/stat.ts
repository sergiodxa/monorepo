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
