/**
 * Party-wide creature operations that are not tied to storage or battle.
 *
 * Right now this covers full restoration — the "creature center" behavior — which
 * clears every party member's damage and major status and refills the PP of each
 * known move from its authored maximum. It reads move PP maxima from the loaded
 * `GameData` and mutates only the persistent health, status, and moves components,
 * so the result survives saves and mirrors what the presentation offers outside
 * battle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";

import type { PlayerId } from "./../world/ids";
import type { World } from "./../world/world";

import { getComponent } from "./../world/helpers";

/** Fully restores every party creature's HP, status, and PP. */
export function healParty(gameData: GameData, world: World, playerId: PlayerId): number {
	let party = getComponent(world.party, playerId);
	if (!party) return 0;

	for (let creatureId of party.creatureIds) {
		world.creatureHealth[creatureId] = { damage: 0 };
		world.creatureStatus[creatureId] = { state: null };

		let moves = getComponent(world.creatureMoves, creatureId);
		if (!moves) continue;
		let pp = moves.moveset.map((moveId) => (moveId ? (gameData.moves.get(moveId)?.pp ?? 0) : 0));
		world.creatureMoves[creatureId] = {
			moveset: [...moves.moveset],
			pp: pp as [number, number, number, number],
		};
	}

	return party.creatureIds.length;
}
