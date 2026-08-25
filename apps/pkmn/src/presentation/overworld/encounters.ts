/**
 * Wild-encounter rolling for the overworld.
 *
 * Rolls against a tile's encounter rate using the Gen 3 style check
 * (`random() < rate / 255`), then picks a species and level from the
 * tile's encounter table or a content fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { EncounterEntry } from "../render/tilemap";

import type { GameMap } from "./map-loader";

/** A resolved encounter: which species appears and at what level. */
export interface EncounterChoice {
	speciesId: string;
	level: number;
}

/** Returns true when stepping onto `(x, y)` should start a wild battle. */
export function rollEncounter(map: GameMap, x: number, y: number, random: () => number): boolean {
	if (!map.isEncounter(x, y)) return false;
	return random() < map.encounterRate(x, y) / 255;
}

/**
 * Chooses the species and level for an encounter.
 *
 * Prefers the tile's weighted table; falls back to a random content
 * species at a low level so a table-less map still produces battles.
 */
export function chooseEncounter(
	table: EncounterEntry[],
	fallbackSpeciesIds: string[],
	random: () => number,
): EncounterChoice | null {
	if (table.length > 0) {
		let total = table.reduce((sum, entry) => sum + entry.weight, 0);
		let roll = random() * total;
		let accumulated = 0;
		for (let entry of table) {
			accumulated += entry.weight;
			if (roll < accumulated)
				return { speciesId: entry.speciesId, level: rollLevel(entry, random) };
		}
		let last = table[table.length - 1]!;
		return { speciesId: last.speciesId, level: rollLevel(last, random) };
	}

	if (fallbackSpeciesIds.length === 0) return null;
	let speciesId = fallbackSpeciesIds[Math.floor(random() * fallbackSpeciesIds.length)]!;
	return { speciesId, level: 2 + Math.floor(random() * 4) };
}

/** Rolls a level within an encounter entry's inclusive range. */
function rollLevel(entry: EncounterEntry, random: () => number): number {
	return entry.minLevel + Math.floor(random() * (entry.maxLevel - entry.minLevel + 1));
}
