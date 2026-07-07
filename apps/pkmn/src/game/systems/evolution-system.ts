/**
 * Updates creature identity state when this system resolves a species-transition event.
 * It centralizes the write that swaps the stored species identifier while preserving the
 * rest of the identity data already attached to the entity.
 *
 * This module exists as the narrow system boundary for this world-state mutation so
 * higher-level game flow can trigger identity changes without needing to know how the
 * identity component is stored or merged back into the ECS world.
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
 * Returns the species a creature can evolve into by level, or null if none applies.
 *
 * Only the `Level` method is evaluated here (the trigger available after a
 * level-up); item, trade, friendship, and place evolutions resolve through their
 * own triggers. The engine emits eligibility and the presentation confirms the
 * actual `evolve-creature`, so this never mutates state.
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
 * Returns the species a creature evolves into when the given item is used on it.
 *
 * Resolves only the `Item` trigger: the creature's species must list a use-item
 * evolution whose required item matches `itemId`. Any other item (or a species with
 * no matching use-item evolution) returns null, so callers can safely offer every
 * item and let this decide whether it evolves the target. Pure lookup; never mutates.
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
 * Returns the species a creature evolves into by trade, or null if none applies.
 *
 * This is a data-only trigger: the engine exposes the eligibility so a future trade
 * flow can act on it, but nothing here can fire a trade on its own. Pure lookup.
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
