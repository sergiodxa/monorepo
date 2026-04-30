import type { Result } from "@pkg/result";

import { failure, success, unwrap } from "@pkg/result";

import type { Item } from "../domain/item";
import type { Move } from "../domain/move";
import type { Nature } from "../domain/nature";
import type { Species } from "../domain/species";
import type { Matchup } from "../domain/type";

import { EvolutionMethod } from "../domain/evolution";
import { Type as ItemType } from "../domain/item";

import { ITEMS } from "./items";
import { TYPE_MATCHUPS } from "./matchups";
import { MOVES } from "./moves";
import { NATURES } from "./natures";
import { SPECIES } from "./species";

/** Loaded and validated content used by the engine at runtime. */
export interface GameData {
	/** All species indexed by their identifier. */
	species: ReadonlyMap<string, Species>;
	/** All moves indexed by their identifier. */
	moves: ReadonlyMap<string, Move>;
	/** All items indexed by their identifier. */
	items: ReadonlyMap<string, Item>;
	/** All natures indexed by their identifier. */
	natures: ReadonlyMap<string, Nature>;
	/** Complete type chart used by battle mechanics. */
	typeChart: Matchup;
}

/** Raw authored content before reference validation. */
export interface GameDataSource {
	/** Authored species records keyed by identifier. */
	species: Record<string, Species>;
	/** Authored move records keyed by identifier. */
	moves: Record<string, Move>;
	/** Authored item records keyed by identifier. */
	items: Record<string, Item>;
	/** Authored nature records keyed by identifier. */
	natures: Record<string, Nature>;
	/** Authored type chart. */
	typeChart: Matchup;
}

/** Reports invalid cross-references in authored content. */
export class GameDataError extends Error {
	/**
	 * @param message - Human-readable validation failure
	 */
	constructor(message: string) {
		super(message);
		this.name = "GameDataError";
	}
}

/**
 * Validates authored content and produces indexed runtime data.
 *
 * @param source - Authored content records
 * @returns Validated runtime maps or the first reference error found
 */
export function createGameData(source: GameDataSource): Result<GameData, GameDataError> {
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
			if (moves.has(learnsetEntry.moveId) === false) {
				return failure(
					new GameDataError(
						`Species ${speciesId} references missing move ${learnsetEntry.moveId}.`,
					),
				);
			}
		}
	}

	for (let [itemId, item] of items) {
		if (
			(item.type === ItemType.HM || item.type === ItemType.MT) &&
			moves.has(item.teachesMoveId) === false
		) {
			return failure(
				new GameDataError(`Item ${itemId} references missing move ${item.teachesMoveId}.`),
			);
		}
	}

	return success({ species, moves, items, natures, typeChart: source.typeChart });
}

/** Validated default content bundle used by the current engine tests. */
export const GAME_DATA = unwrap(
	createGameData({
		species: SPECIES,
		moves: MOVES,
		items: ITEMS,
		natures: NATURES,
		typeChart: TYPE_MATCHUPS,
	}),
);
