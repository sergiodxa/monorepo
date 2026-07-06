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

import { getCreatureLevel, getCreatureSpecies, getCreatureStat } from "../battle/mechanics";
import { Stat } from "../data/stat";
import { createCreatureFromWorld, getCreatureComponentSet } from "../world/world";

/** One creature's experience gain and resulting level delta. */
export interface ExperienceGrant {
	creatureId: CreatureId;
	levelBefore: number;
	levelAfter: number;
	totalExperience: number;
}

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

/**
 * Awards experience for defeated enemies to the surviving party members.
 *
 * Uses the Gen 3 base formula `floor(baseExperience * enemyLevel / 7)` split
 * evenly among non-fainted participants. Fainted party members earn nothing, and
 * enemies must still exist (call this before despawning uncaptured wild creatures).
 * Returns one grant per creature that gained experience so the caller can emit the
 * matching progression events.
 */
export function awardBattleExperience(
	gameData: GameData,
	world: World,
	enemyIds: CreatureId[],
	partyIds: CreatureId[],
): ExperienceGrant[] {
	let survivors = partyIds.filter((creatureId) => {
		let creature = createCreatureFromWorld(world, creatureId);
		let maxHP = getCreatureStat(gameData, creature, Stat.HP);
		return (world.creatureHealth[creatureId]?.damage ?? 0) < maxHP;
	});
	if (survivors.length === 0) return [];

	let grants: ExperienceGrant[] = [];
	for (let enemyId of enemyIds) {
		if (!world.creatureIdentity[enemyId]) continue;
		let enemy = createCreatureFromWorld(world, enemyId);
		let species = getCreatureSpecies(gameData, enemy);
		let level = getCreatureLevel(gameData, enemy);
		let award = Math.floor(Math.floor((species.baseExperience * level) / 7) / survivors.length);
		if (award <= 0) continue;
		for (let creatureId of survivors) {
			grants.push({ creatureId, ...grantCreatureExperience(gameData, world, creatureId, award) });
		}
	}
	return grants;
}
