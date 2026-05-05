/**
 * Evolution data contracts for the game data layer.
 *
 * This module centralizes the type-level representation of evolution methods and
 * the payload shape required for each supported evolution path. It provides a
 * shared vocabulary for describing how one species can transform into another
 * without coupling that description to engine logic or presentation concerns.
 *
 * By keeping these definitions together, the module establishes a single source
 * of truth for evolution-related data exchanged across the game domain. The
 * exported enum, namespace interfaces, and union type make evolution records
 * explicit, constrained, and easy to consume anywhere that needs to read or
 * validate structured evolution information.
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
