import type { Evolution } from "./evolution";
import type { Move } from "./move";
import type { StatSet } from "./stat";

import { GrowthRate } from "./growth-rate";
import { Type } from "./type";

/** A move a creature can learn, and the method by which it is learned */
export type LearnsetEntry =
	| { level: number; move: Move }
	| { tmhm: number; move: Move }
	| { tutor: true; move: Move }
	| { egg: true; move: Move };

export enum Genre {
	Male,
	Female,
	Genderless,
}

export namespace Species {
	export type Symbol = string & { __brand: "Species" };
}

export interface Species {
	/** ID of the creature species */
	number: number;
	/** Type or pair of types of the creature */
	types: [Type] | [Type, Type];
	/** Base experience gained for defeating this creature */
	baseExperience: number;
	/** Catch rate of the creature */
	catchRate: number;
	/** Growth rate of the creature */
	growthRate: GrowthRate;
	/** Base stats of the creature */
	stats: StatSet;
	/** Evolutions of the creature */
	evolutions: Evolution[];
	/** Learnset of the creature */
	learnset: LearnsetEntry[];
	/** Genders a creature can be, if any */
	gender: Genre.Genderless | { [K in Genre.Male | Genre.Female]?: number };
}

export function isSpeciesSymbol(value: unknown): value is Species.Symbol {
	return typeof value === "string";
}

export function assertsSpeciesSymbol(value: unknown): asserts value is Species.Symbol {
	if (!isSpeciesSymbol(value)) {
		throw new TypeError(`Expected a Species.Symbol, but got ${typeof value}`);
	}
}
