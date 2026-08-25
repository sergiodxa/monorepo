/**
 * Runtime container and source contract for the game's authored data: the
 * shape of incoming records, and the validated, indexed structure the
 * engine consumes after cross-reference checks reject invalid content.
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
	species: Record<string, Species>;
	moves: Record<string, Move>;
	items: Record<string, Item>;
	natures: Record<string, Nature>;
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
