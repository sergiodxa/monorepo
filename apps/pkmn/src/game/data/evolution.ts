/**
 * Evolution data contracts for the game data layer.
 *
 * Centralizes evolution methods and their per-method payload shapes so
 * species data and engine logic share one vocabulary for evolution paths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ItemId } from "./item";
import type { SpeciesId } from "./species";

/** Evolution method of a creature */
export enum EvolutionMethod {
	Level = "level",
	Item = "item",
	Trade = "trade",
	Friendship = "friendship",
	Place = "place",
}

export namespace Evolution {
	export interface ByLevel {
		method: EvolutionMethod.Level;
		speciesId: SpeciesId;
		level: number;
	}

	export interface ByTrade {
		method: EvolutionMethod.Trade;
		speciesId: SpeciesId;
	}

	export interface ByItem {
		method: EvolutionMethod.Item;
		speciesId: SpeciesId;
		itemId: ItemId;
	}

	export interface ByFriendship {
		method: EvolutionMethod.Friendship;
		speciesId: SpeciesId;
		level: number;
	}

	export interface ByPlace {
		method: EvolutionMethod.Place;
		speciesId: SpeciesId;
		placeId: number;
	}
}

/** Evolution information of a creature */
export type Evolution =
	| Evolution.ByLevel
	| Evolution.ByItem
	| Evolution.ByTrade
	| Evolution.ByFriendship
	| Evolution.ByPlace;
