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
import type { SpeciesId } from "../data/species";
import type { CreatureId } from "../world/ids";
import type { World } from "../world/world";

import { getCreatureComponentSet } from "../world/world";

/** Replaces one creature's species identity after an evolution decision resolves. */
export function evolveCreature(world: World, creatureId: CreatureId, speciesId: SpeciesId) {
	let components = getCreatureComponentSet(world, creatureId);
	world.creatureIdentity[creatureId] = {
		...components.identity,
		speciesId,
	};

	return world.creatureIdentity[creatureId]!;
}
