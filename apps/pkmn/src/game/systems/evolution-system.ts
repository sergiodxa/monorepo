/**
 * Swaps a creature's stored species identifier when an evolution decision
 * resolves, and exposes level, item, and trade evolution lookups as pure
 * eligibility checks so higher-level flow decides whether to apply the swap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "../data/game-data";
import type { ItemId } from "../data/item";
import type { SpeciesId } from "../data/species";
import type { CreatureId } from "../world/ids";
import type { World } from "../world/world";

import { getCreatureLevel, getCreatureSpecies } from "../battle/mechanics";
import { EvolutionMethod } from "../data/evolution";
import { createCreatureFromWorld, getCreatureComponentSet } from "../world/world";

/** Replaces one creature's species identity after an evolution decision resolves. */
export function evolveCreature(world: World, creatureId: CreatureId, speciesId: SpeciesId) {
	let components = getCreatureComponentSet(world, creatureId);
	world.creatureIdentity[creatureId] = {
		...components.identity,
		speciesId,
	};

	return world.creatureIdentity[creatureId]!;
}

/**
 * Evaluates only the `Level` evolution trigger; item, trade, friendship, and
 * place evolutions resolve through their own triggers. Reports eligibility
 * without mutating state, leaving the species swap to the caller.
 */
export function getLevelUpEvolution(
	gameData: GameData,
	world: World,
	creatureId: CreatureId,
): SpeciesId | null {
	let creature = createCreatureFromWorld(world, creatureId);
	let level = getCreatureLevel(gameData, creature);
	for (let evolution of getCreatureSpecies(gameData, creature).evolutions) {
		if (evolution.method === EvolutionMethod.Level && level >= evolution.level) {
			return evolution.speciesId;
		}
	}
	return null;
}

/**
 * Resolves only the `Item` trigger, matching the creature's use-item evolution
 * to `itemId`. Returns null otherwise so callers can offer every item without
 * checking eligibility first; pure lookup, never mutates.
 */
export function getItemEvolution(
	gameData: GameData,
	world: World,
	creatureId: CreatureId,
	itemId: ItemId,
): SpeciesId | null {
	let creature = createCreatureFromWorld(world, creatureId);
	for (let evolution of getCreatureSpecies(gameData, creature).evolutions) {
		if (evolution.method === EvolutionMethod.Item && evolution.itemId === itemId) {
			return evolution.speciesId;
		}
	}
	return null;
}

/**
 * Exposes trade eligibility as data only, for a future trade flow to act on.
 * Pure lookup; never mutates.
 */
export function getTradeEvolution(
	gameData: GameData,
	world: World,
	creatureId: CreatureId,
): SpeciesId | null {
	let creature = createCreatureFromWorld(world, creatureId);
	for (let evolution of getCreatureSpecies(gameData, creature).evolutions) {
		if (evolution.method === EvolutionMethod.Trade) return evolution.speciesId;
	}
	return null;
}
