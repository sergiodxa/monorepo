import type { Species } from "./species";

/** Evolution method of a creature */
export enum EvolutionMethod {
	Level,
	Item,
	Trade,
	Friendship,
}

export namespace Evolution {
	export interface ByLevel {
		method: EvolutionMethod.Level;
		speciesId: Species.Symbol;
		level: number;
	}

	export interface ByItem {
		method: EvolutionMethod.Item;
		speciesId: Species.Symbol;
		itemId: string;
	}

	export interface ByTrade {
		method: EvolutionMethod.Trade;
		speciesId: Species.Symbol;
	}

	export interface ByFriendship {
		method: EvolutionMethod.Friendship;
		speciesId: Species.Symbol;
		level: number;
	}
}

/** Evolution information of a creature */
export type Evolution =
	| Evolution.ByLevel
	| Evolution.ByItem
	| Evolution.ByTrade
	| Evolution.ByFriendship;
