/**
 * Wild-encounter rolling for the overworld.
 *
 * When the player steps onto a tall-grass tile the scene rolls against the tile's
 * encounter rate (`random() < rate / 255`, the Gen 3 style check) and, on a hit,
 * picks a wild creature from the pre-seeded pool. Until the planned
 * `spawn-encounter` engine command exists, the pool is the set of wild creatures
 * the new-game world seeds; this module hides that so the scene only asks "is
 * there an encounter, and which creature?".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameMap } from "./map-loader";

/** Returns true when stepping onto `(x, y)` should start a wild battle. */
export function rollEncounter(map: GameMap, x: number, y: number, random: () => number): boolean {
	if (!map.isEncounter(x, y)) return false;
	return random() < map.encounterRate(x, y) / 255;
}

/** Picks one wild creature id from the seeded pool, or null when it is empty. */
export function pickWildCreature(pool: string[], random: () => number): string | null {
	if (pool.length === 0) return null;
	return pool[Math.floor(random() * pool.length)] ?? null;
}
