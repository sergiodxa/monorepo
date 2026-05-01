import type { Evolution } from "./evolution";
import type { MoveId } from "./move";
import type { StatSet } from "./stat";

import { GrowthRate } from "./growth-rate";
import { Type } from "./type";

/** String identifier of a species in loaded game data. */
export type SpeciesId = string;

/** A move a creature can learn, and the method by which it is learned */
export type LearnsetEntry =
	| { level: number; moveId: MoveId }
	| { tmhm: number }
	| { tutor: true; moveId: MoveId }
	| { egg: true; moveId: MoveId };

export enum Genre {
	Male,
	Female,
	Genderless,
}

/** Physical dimensions used by size-based battle mechanics. */
export interface Size {
	/** Weight in kilograms. */
	weight: number;
	/** Height in meters. */
	height: number;
}

export interface Species {
	/** ID of the creature species */
	number: number;
	/** Physical dimensions used by size-based mechanics. */
	size: Size;
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

export function isSpeciesId(value: unknown): value is SpeciesId {
	return typeof value === "string";
}

export function assertsSpeciesId(value: unknown): asserts value is SpeciesId {
	if (!isSpeciesId(value)) {
		throw new TypeError(`Expected a SpeciesId, but got ${typeof value}`);
	}
}
