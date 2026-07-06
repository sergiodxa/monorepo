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
