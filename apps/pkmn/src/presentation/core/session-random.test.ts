/**
 * Tests for a play session's random streams: the same seed opens the same
 * streams, each subsystem's stream stays independent of the others' draws,
 * and a snapshot restores every stream where it stood.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { openSessionRandom, restoreSessionRandom, snapshotSessionRandom } from "./session-random";

test("the same seed replays the same session", () => {
	let first = openSessionRandom(42);
	let second = openSessionRandom(42);

	expect(first.seed).toBe(42);
	expect(Array.from({ length: 5 }, () => first.encounters.next())).toEqual(
		Array.from({ length: 5 }, () => second.encounters.next()),
	);
});

test("extra battle draws leave the encounter stream untouched", () => {
	let quiet = openSessionRandom("independent");
	let busy = openSessionRandom("independent");
	for (let count = 0; count < 50; count++) busy.battle.next();

	expect(busy.encounters.int(0, 1_000_000)).toBe(quiet.encounters.int(0, 1_000_000));
});

test("a fresh session draws its own seed", () => {
	expect(openSessionRandom().seed).not.toBe(openSessionRandom().seed);
});

test("a snapshot survives JSON and resumes every stream", () => {
	let original = openSessionRandom("snapshot");
	original.movement.next();
	original.creatures.next();
	let restored = restoreSessionRandom(JSON.parse(JSON.stringify(snapshotSessionRandom(original))));

	expect(restored.seed).toBe("snapshot");
	expect(restored.movement.next()).toBe(original.movement.next());
	expect(restored.creatures.next()).toBe(original.creatures.next());
});
