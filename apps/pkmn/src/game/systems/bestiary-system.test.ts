/**
 * Verifies the bestiary system's discovery and capture record rules in isolation from the engine.
 *
 * The tests confirm that marking a species seen appends without duplicating, that marking a species
 * caught records it in both the caught and seen collections (the caught-implies-seen invariant), and
 * that both operations are idempotent across repeated calls. They build a one-player world so the
 * assertions describe the system's rules directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { type World } from "../world/world";

import { markSpeciesCaught, markSpeciesSeen } from "./bestiary-system";

let SPECIES_A = "SPECIES_A";
let SPECIES_B = "SPECIES_B";

/** Builds a one-player world seeded with optional bestiary progress. */
function createWorld(
	seen: string[] = [],
	caught: string[] = [],
): { world: World; playerId: string } {
	let playerId = createPlayerId("hero");
	let world = migrateWorld({
		entities: [playerId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [] } },
		inventory: { [playerId]: { items: {} } },
		money: { [playerId]: { amount: 0 } },
		bestiary: { [playerId]: { seen, caught } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: {},
	});
	return { world, playerId };
}

test("markSpeciesSeen records a newly encountered species", () => {
	let { world, playerId } = createWorld();
	let bestiary = markSpeciesSeen(world, playerId, SPECIES_A);
	expect(bestiary.seen).toEqual([SPECIES_A]);
	expect(bestiary.caught).toEqual([]);
});

test("markSpeciesSeen appends distinct species while preserving order", () => {
	let { world, playerId } = createWorld();
	markSpeciesSeen(world, playerId, SPECIES_A);
	let bestiary = markSpeciesSeen(world, playerId, SPECIES_B);
	expect(bestiary.seen).toEqual([SPECIES_A, SPECIES_B]);
});

test("markSpeciesSeen is idempotent and does not duplicate an existing entry", () => {
	let { world, playerId } = createWorld([SPECIES_A]);
	let bestiary = markSpeciesSeen(world, playerId, SPECIES_A);
	expect(bestiary.seen).toEqual([SPECIES_A]);
});

test("markSpeciesCaught records the species in both caught and seen", () => {
	let { world, playerId } = createWorld();
	let bestiary = markSpeciesCaught(world, playerId, SPECIES_A);
	expect(bestiary.caught).toEqual([SPECIES_A]);
	expect(bestiary.seen).toEqual([SPECIES_A]);
});

test("markSpeciesCaught does not re-add to seen when already seen", () => {
	let { world, playerId } = createWorld([SPECIES_A]);
	let bestiary = markSpeciesCaught(world, playerId, SPECIES_A);
	expect(bestiary.seen).toEqual([SPECIES_A]);
	expect(bestiary.caught).toEqual([SPECIES_A]);
});

test("markSpeciesCaught is idempotent across repeated calls", () => {
	let { world, playerId } = createWorld();
	markSpeciesCaught(world, playerId, SPECIES_A);
	let bestiary = markSpeciesCaught(world, playerId, SPECIES_A);
	expect(bestiary.seen).toEqual([SPECIES_A]);
	expect(bestiary.caught).toEqual([SPECIES_A]);
});

test("markSpeciesCaught keeps seen-only species alongside caught species", () => {
	let { world, playerId } = createWorld([SPECIES_A]);
	let bestiary = markSpeciesCaught(world, playerId, SPECIES_B);
	expect(bestiary.seen).toEqual([SPECIES_A, SPECIES_B]);
	expect(bestiary.caught).toEqual([SPECIES_B]);
});
