/**
 * Coordinates the capture flow for encounter creatures within the game world.
 *
 * This module converts a creature from an encounter-owned state into a player-owned state and records its resulting placement. It updates ownership, assigns the creature to the active party when capacity is available, and falls back to persistent storage when the party is full.
 *
 * By keeping these transitions together, the module centralizes the rules for where newly captured creatures are placed and how their world location is tracked after capture. This helps the rest of the game rely on a single, consistent entry point for capture-related state changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "../data/game-data";
import type { State } from "../data/status";
import type { CreatureId, PlayerId } from "../world/ids";
import type { World } from "../world/world";

import { State as StatusState } from "../data/status";
import { createCreatureInstance, rollGender } from "../world/components";
import { getCreatureComponentSet, getPlayerParty, getPlayerStorageBoxes } from "../world/world";

import { ensureStorageBox } from "./storage-system";

/** Outcome of one capture attempt: shakes shown (0..3) and whether it caught. */
export interface CaptureAttempt {
	shakes: number;
	success: boolean;
}

/** The Gen 3 status catch multiplier: sleep/freeze x2, other major statuses x1.5. */
export function captureStatusBonus(state: State | null): number {
	if (state === StatusState.Asleep || state === StatusState.Frozen) return 2;
	if (state === null) return 1;
	return 1.5;
}

/**
 * Runs the Gen 3 capture attempt: computes the catch value and rolls up to four shakes.
 *
 * `a = floor((3*maxHP - 2*currentHP) * catchRate * ballMultiplier / (3*maxHP)) * statusBonus`.
 * When `a >= 255` the catch is guaranteed; otherwise four shake checks run against
 * `b = floor(1048560 / floor(sqrt(floor(sqrt(floor(16711680 / a))))))`, and the
 * catch succeeds only if all four pass. On failure the number of passing shakes is
 * reported (capped at 3).
 */
export function computeCaptureAttempt(params: {
	maxHP: number;
	currentHP: number;
	catchRate: number;
	ballMultiplier: number;
	statusBonus: number;
	random: () => number;
}): CaptureAttempt {
	let { maxHP, currentHP, catchRate, ballMultiplier, statusBonus, random } = params;
	let a =
		Math.floor(((3 * maxHP - 2 * currentHP) * catchRate * ballMultiplier) / (3 * maxHP)) *
		statusBonus;
	if (a >= 255) return { shakes: 3, success: true };
	if (a < 1) return { shakes: 0, success: false };

	let b = Math.floor(
		1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / a))))),
	);
	let shakes = 0;
	for (let check = 0; check < 4; check += 1) {
		if (Math.floor(random() * 65536) < b) shakes += 1;
		else break;
	}
	return { shakes: Math.min(shakes, 3), success: shakes === 4 };
}

/**
 * Converts one encounter creature into an owned creature and places it in party or storage.
 *
 * When `gameData` and `random` are supplied the capture also guarantees per-instance
 * state exists, rolling a gender from the species ratio for any creature that reached
 * capture without one (spawned creatures already carry theirs, so this is a no-op for
 * them). The roll flows through the injected RNG so seeded sessions stay reproducible.
 */
export function captureCreature(
	world: World,
	playerId: PlayerId,
	creatureId: CreatureId,
	gameData?: GameData,
	random?: () => number,
) {
	let party = getPlayerParty(world);
	world.ownership[creatureId] = { ownerId: playerId };

	if (gameData && random && !world.creatureInstance[creatureId]) {
		let speciesId = getCreatureComponentSet(world, creatureId).identity.speciesId;
		let species = gameData.species.get(speciesId);
		world.creatureInstance[creatureId] = createCreatureInstance(
			species ? { gender: rollGender(species.gender, random) } : {},
		);
	}

	if (party.creatureIds.length < 6) {
		world.party[playerId] = { creatureIds: [...party.creatureIds, creatureId] };
		world.creatureLocation[creatureId] = {
			kind: "party",
			playerId,
			slot: party.creatureIds.length,
		};
		return { placement: "party" as const };
	}

	ensureStorageBox(world, playerId);
	let storage = getPlayerStorageBoxes(world);
	let box = storage.boxes[0]!;
	world.storageBoxes[playerId] = {
		boxes: storage.boxes.map((entry, index) =>
			index === 0 ? { ...entry, creatureIds: [...entry.creatureIds, creatureId] } : entry,
		),
	};
	world.creatureLocation[creatureId] = {
		kind: "storage",
		playerId,
		boxId: box.id,
		slot: box.creatureIds.length,
	};

	return { placement: "storage" as const, boxId: box.id };
}
