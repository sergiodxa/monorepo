/**
 * Coordinates experience updates for creature progression within the game systems layer.
 * This module applies earned experience to the world state and exposes the before-and-after
 * level information needed by callers that react to progression changes.
 *
 * The logic here stays focused on progression bookkeeping for a single creature. It bridges
 * immutable game data, mutable world storage, and derived level calculations so other parts
 * of the engine can award experience without duplicating state update or comparison logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "../data/game-data";
import type { CreatureId } from "../world/ids";
import type { World } from "../world/world";

import { getCreatureLevel } from "../battle/mechanics";
import { createCreatureFromWorld, getCreatureComponentSet } from "../world/world";

/** Applies earned experience and reports the level delta for selector and event updates. */
export function grantCreatureExperience(
	gameData: GameData,
	world: World,
	creatureId: CreatureId,
	experience: number,
) {
	let before = createCreatureFromWorld(world, creatureId);
	let levelBefore = getCreatureLevel(gameData, before);
	let components = getCreatureComponentSet(world, creatureId);
	world.creatureProgress[creatureId] = {
		...components.progress,
		experience: components.progress.experience + Math.max(0, experience),
	};

	let after = createCreatureFromWorld(world, creatureId);
	let levelAfter = getCreatureLevel(gameData, after);

	return { levelBefore, levelAfter, totalExperience: after.experience };
}
