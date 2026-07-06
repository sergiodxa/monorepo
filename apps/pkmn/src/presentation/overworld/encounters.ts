/**
 * Wild-encounter rolling for the overworld.
 *
 * When the player steps onto a tall-grass tile the scene rolls against the tile's
 * encounter rate (`random() < rate / 255`, the Gen 3 style check) and, on a hit,
 * chooses a species and level — from the tile's authored encounter table when it
 * has one, otherwise from the loaded content as a fallback. The scene turns that
 * choice into a wild creature through the engine's `spawn-encounter` command.
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
 * Prefers the tile's weighted encounter table; when a map ships none (like the
 * built-in sample), it falls back to a random content species at a low level so
 * the overworld still produces battles.
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
