/**
 * Central species data contracts for the game content layer.
 *
 * Defines the identifiers, enums, structural types, and guards that shape a
 * species entry, keeping data normalized and reusable across validation,
 * battle logic, and progression systems.
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

/**
 * A move a creature learns on reaching a given level.
 *
 * The generic level-up variant of {@link LearnsetEntry}, so progression
 * code can match level-up moves without checking the full learnset union.
 */
export type LevelUpMove = { level: number; moveId: MoveId };

/** A move a creature can learn, and the method by which it is learned */
export type LearnsetEntry =
	| LevelUpMove
	| { tmhm: number }
	| { tutor: true; moveId: MoveId }
	| { egg: true; moveId: MoveId };

/** Narrows a learnset entry to its level-up variant. */
export function isLevelUpMove(entry: LearnsetEntry): entry is LevelUpMove {
	return "level" in entry && "moveId" in entry;
}

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

/**
 * Reference to the artwork associated with a species, or `null` for none.
 *
 * Holds opaque identifiers the presentation layer resolves against the
 * asset manifest, so the species editor can associate creature art.
 */
export type SpeciesSprite = { atlas: string; region: string } | { image: string } | null;

export interface Species {
	/** ID of the creature species */
	number: number;
	size: Size;
	types: [string] | [string, string];
	/** Base experience gained for defeating this creature */
	baseExperience: number;
	catchRate: number;
	growthRate: GrowthRate;
	stats: StatSet;
	/**
	 * Effort values awarded to each participant when this species faints, keyed
	 * by {@link Stat} with a missing stat worth zero EVs. Optional so award code
	 * tolerates its absence even though content always supplies one.
	 */
	evYield?: Partial<StatSet>;
	evolutions: Evolution[];
	learnset: LearnsetEntry[];
	/** Genders a creature can be, if any */
	gender: Gender.Genderless | { [K in Gender.Male | Gender.Female]?: number };
	eggGroup: EggGroups;
	/**
	 * Artwork associated with this species, or `null`/absent for none. Set by
	 * the species editor for presentation code to resolve. See
	 * {@link SpeciesSprite}.
	 */
	sprite?: SpeciesSprite;
}

export function isSpeciesId(value: unknown): value is SpeciesId {
	return typeof value === "string";
}

export function assertsSpeciesId(value: unknown): asserts value is SpeciesId {
	if (!isSpeciesId(value)) {
		throw new TypeError(`Expected a SpeciesId, but got ${typeof value}`);
	}
}
