/**
 * Central species data contracts for the game content layer.
 *
 * This module defines the identifiers, enums, structural types, and guards used
 * to describe a species entry as loaded data. It establishes the shape of
 * species records so other parts of the game can read consistent information
 * about typing, progression, breeding, learnsets, and physical traits.
 *
 * By concentrating these contracts in one place, the module provides a stable
 * boundary between raw content and the systems that consume it. It helps keep
 * species-related data normalized, typed, and reusable across validation,
 * battle logic, progression systems, and other game features that depend on the
 * same canonical structure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Evolution } from "./evolution";
import type { MoveId } from "./move";
import type { StatSet } from "./stat";

import { GrowthRate } from "./growth-rate";

/** String identifier of a species in loaded game data. */
export type SpeciesId = string;

/** A move a creature can learn, and the method by which it is learned */
export type LearnsetEntry =
	| { level: number; moveId: MoveId }
	| { tmhm: number }
	| { tutor: true; moveId: MoveId }
	| { egg: true; moveId: MoveId };

export enum Gender {
	Male = "male",
	Female = "female",
	Genderless = "genderless",
}

/** Breeding compatibility group used by species eggs. */
export enum EggGroup {
	Monster = "monster",
	Water1 = "water1",
	Bug = "bug",
	Flying = "flying",
	Ground = "ground",
	Fairy = "fairy",
	Plant = "plant",
	HumanShape = "humanShape",
	Water3 = "water3",
	Mineral = "mineral",
	Indeterminate = "indeterminate",
	Water2 = "water2",
	Ditto = "ditto",
	Dragon = "dragon",
	NoEggs = "noEggs",
}

/** One or two breeding compatibility groups assigned to a species. */
export type EggGroups = [EggGroup] | [EggGroup, EggGroup];

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
	types: [string] | [string, string];
	/** Base experience gained for defeating this creature */
	baseExperience: number;
	/** Catch rate of the creature */
	catchRate: number;
	/** Growth rate of the creature */
	growthRate: GrowthRate;
	/** Base stats of the creature */
	stats: StatSet;
	/**
	 * Effort values awarded to each participant when this species faints. A
	 * partial map keyed by {@link Stat}; a missing stat contributes no EVs.
	 * Optional on the contract so the award code tolerates its absence (treating
	 * a missing yield as zero EVs); the content layer guarantees every species
	 * carries one.
	 */
	evYield?: Partial<StatSet>;
	/** Evolutions of the creature */
	evolutions: Evolution[];
	/** Learnset of the creature */
	learnset: LearnsetEntry[];
	/** Genders a creature can be, if any */
	gender: Gender.Genderless | { [K in Gender.Male | Gender.Female]?: number };
	/** Breeding compatibility group for this creature. */
	eggGroup: EggGroups;
}

export function isSpeciesId(value: unknown): value is SpeciesId {
	return typeof value === "string";
}

export function assertsSpeciesId(value: unknown): asserts value is SpeciesId {
	if (!isSpeciesId(value)) {
		throw new TypeError(`Expected a SpeciesId, but got ${typeof value}`);
	}
}
