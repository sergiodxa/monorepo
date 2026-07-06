/**
 * Coordinates experience and effort value updates for creature progression within the game
 * systems layer. This module applies earned experience and a fainted species' EV yield to the
 * world state and exposes the before-and-after level information callers react to.
 *
 * The logic here stays focused on progression bookkeeping for a single creature. It bridges
 * immutable game data, mutable world storage, and derived level calculations so other parts
 * of the engine can award experience and effort values without duplicating state update, cap,
 * or comparison logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "../data/game-data";
import type { Species } from "../data/species";
import type { StatSet } from "../data/stat";
import type { CreatureId } from "../world/ids";
import type { World } from "../world/world";

import { getCreatureLevel, getCreatureSpecies, getCreatureStat } from "../battle/mechanics";
import { Stat } from "../data/stat";
import { createCreatureFromWorld, getCreatureComponentSet } from "../world/world";

/** Highest effort value a single stat may hold. */
const MAX_EV_PER_STAT = 255;

/** Highest combined effort value across every stat. */
const MAX_EV_TOTAL = 510;

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
 * Adds a fainted species' effort value yield to a creature's stored EVs.
 *
 * Each stat is clamped to {@link MAX_EV_PER_STAT} and the running total to
 * {@link MAX_EV_TOTAL}; once the total cap is reached no further EVs are added,
 * so a partially-trained creature only gains the remaining headroom. A missing
 * or empty yield is a no-op. Writes back the whole progress component to match
 * the mutation style used elsewhere in this module.
 */
export function grantCreatureEvYield(
	world: World,
	creatureId: CreatureId,
	evYield: Species["evYield"] | undefined,
) {
	if (!evYield) return;

	let components = getCreatureComponentSet(world, creatureId);
	let ev: StatSet = { ...components.progress.ev };
	let total = sumEffortValues(ev);

	for (let stat of Object.values(Stat)) {
		let gain = evYield[stat] ?? 0;
		if (gain <= 0) continue;
		if (total >= MAX_EV_TOTAL) break;

		let allowedByTotal = MAX_EV_TOTAL - total;
		let allowedByStat = MAX_EV_PER_STAT - ev[stat];
		let applied = Math.min(gain, allowedByStat, allowedByTotal);
		if (applied <= 0) continue;

		ev[stat] += applied;
		total += applied;
	}

	world.creatureProgress[creatureId] = { ...components.progress, ev };
}

/** Sums every stat's effort value to enforce the 510-point total cap. */
function sumEffortValues(ev: StatSet): number {
	let total = 0;
	for (let stat of Object.values(Stat)) total += ev[stat];
	return total;
}

/**
 * Awards experience and effort values for defeated enemies to the surviving party.
 *
 * Uses the Gen 3 base formula `floor(baseExperience * enemyLevel / 7)` split
 * evenly among non-fainted participants. Each survivor also gains the fainted
 * species' `evYield` (per-stat and total caps enforced by
 * {@link grantCreatureEvYield}); EVs are awarded on faint even when the split
 * experience rounds down to zero. Fainted party members earn nothing, and
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

		for (let creatureId of survivors) {
			grantCreatureEvYield(world, creatureId, species.evYield);
		}

		let award = Math.floor(Math.floor((species.baseExperience * level) / 7) / survivors.length);
		if (award <= 0) continue;
		for (let creatureId of survivors) {
			grants.push({ creatureId, ...grantCreatureExperience(gameData, world, creatureId, award) });
		}
	}
	return grants;
}
