/**
 * This module defines the runtime container and source contract for the game's authored data. It provides the types that describe incoming records and the validated structure consumed by the engine once that content has been indexed for efficient access.
 *
 * It also centralizes cross-reference validation for this data set, ensuring the module can reject inconsistent authored records before they are used at runtime. By keeping the loading, indexing, and validation responsibilities together, the module establishes a single boundary between raw authored data and trusted runtime data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { Item } from "./item";
import type { Move } from "./move";
import type { Nature } from "./nature";
import type { Species } from "./species";
import type { Matchup } from "./type";

import { EvolutionMethod } from "./evolution";

/** Raw authored content before reference validation. */
export interface GameDataSource<T extends string | number | symbol = string> {
	/** Authored species records keyed by identifier. */
	species: Record<string, Species>;
	/** Authored move records keyed by identifier. */
	moves: Record<string, Move>;
	/** Authored item records keyed by identifier. */
	items: Record<string, Item>;
	/** Authored nature records keyed by identifier. */
	natures: Record<string, Nature>;
	/** Authored type chart. */
	typeChart: Matchup<T>;
}

/** Reports invalid cross-references in authored content. */
export class GameDataError extends Error {
	override name = "GameDataError";
}

/** Loaded and validated content used by the engine at runtime. */
export class GameData<T extends string | number | symbol = string> {
	/**
	 * @param species - All species indexed by identifier
	 * @param moves - All moves indexed by identifier
	 * @param items - All items indexed by identifier
	 * @param natures - All natures indexed by identifier
	 * @param typeChart - Complete type chart used by mechanics
	 */
	constructor(
		public readonly species: ReadonlyMap<string, Species>,
		public readonly moves: ReadonlyMap<string, Move>,
		public readonly items: ReadonlyMap<string, Item>,
		public readonly natures: ReadonlyMap<string, Nature>,
		public readonly typeChart: Matchup<T>,
	) {}

	/**
	 * Validates authored content and produces indexed runtime data.
	 *
	 * @param source - Authored content records
	 * @returns Validated runtime maps or the first reference error found
	 */
	static create<T extends string | number | symbol = string>(
		this: void,
		source: GameDataSource<T>,
	): Result<GameData<T>, GameDataError> {
		let species = new Map(Object.entries(source.species));
		let moves = new Map(Object.entries(source.moves));
		let items = new Map(Object.entries(source.items));
		let natures = new Map(Object.entries(source.natures));

		for (let [speciesId, creatureSpecies] of species) {
			for (let evolution of creatureSpecies.evolutions) {
				if (species.has(evolution.speciesId) === false) {
					return failure(
						new GameDataError(
							`Species ${speciesId} references missing evolution species ${evolution.speciesId}.`,
						),
					);
				}

				if (evolution.method === EvolutionMethod.Item && items.has(evolution.itemId) === false) {
					return failure(
						new GameDataError(
							`Species ${speciesId} references missing evolution item ${evolution.itemId}.`,
						),
					);
				}
			}

			for (let learnsetEntry of creatureSpecies.learnset) {
				if ("moveId" in learnsetEntry && moves.has(learnsetEntry.moveId) === false) {
					return failure(
						new GameDataError(
							`Species ${speciesId} references missing move ${learnsetEntry.moveId}.`,
						),
					);
				}
			}
		}

		for (let [itemId, item] of items) {
			if ("teachesMoveId" in item && moves.has(item.teachesMoveId) === false) {
				return failure(
					new GameDataError(`Item ${itemId} references missing move ${item.teachesMoveId}.`),
				);
			}
		}

		return success(new GameData<T>(species, moves, items, natures, source.typeChart));
	}
}
