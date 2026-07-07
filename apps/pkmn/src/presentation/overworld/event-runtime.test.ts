/**
 * Verifies spawning live entities from a map's authored events.
 *
 * Spawning is the pure enter-a-map step: every non-gated event becomes an entity
 * at its authored tile, an event whose completion flag is already set is skipped
 * (its one-time interaction is spent), and a `once` event with no explicit flag
 * gets a stable synthesized completion flag so it stays one-time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { MapEvent } from "../render/map-schema";

import { completionFlag, eventAt, spawnEvents } from "./event-runtime";

/** Builds one authored event with sensible defaults for the fields under test. */
function event(overrides: Partial<MapEvent> & Pick<MapEvent, "id">): MapEvent {
	return {
		x: 0,
		y: 0,
		kind: "npc",
		facing: "down",
		sprite: null,
		movement: "none",
		interaction: { script: [], trainer: undefined, wild: undefined },
		interactionMode: "action",
		flag: undefined,
		once: false,
		...overrides,
	};
}

test("spawnEvents turns every ungated event into an entity at its authored tile", () => {
	let events = [
		event({ id: "a", x: 3, y: 4, facing: "left" }),
		event({ id: "b", x: 7, y: 2, kind: "trigger" }),
	];
	let entities = spawnEvents(events, () => false);

	expect(entities).toHaveLength(2);
	expect(entities[0]).toMatchObject({ id: "a", x: 3, y: 4, facing: "left", done: false });
	expect(entities[1]).toMatchObject({ id: "b", x: 7, y: 2, kind: "trigger" });
});

test("spawnEvents skips an event whose explicit flag is already set", () => {
	let events = [event({ id: "gate", flag: "gate-cleared" })];

	expect(spawnEvents(events, (flag) => flag === "gate-cleared")).toHaveLength(0);
	expect(spawnEvents(events, () => false)).toHaveLength(1);
});

test("spawnEvents skips a once event via its synthesized completion flag", () => {
	let events = [event({ id: "legendary", once: true })];
	let synthesized = completionFlag(events[0]!)!;

	expect(synthesized).toBe("event:legendary:done");
	expect(spawnEvents(events, (flag) => flag === synthesized)).toHaveLength(0);
	expect(spawnEvents(events, () => false)).toHaveLength(1);
});

test("completionFlag prefers an explicit flag, then synthesizes for once, else null", () => {
	expect(completionFlag({ id: "x", flag: "named", once: true })).toBe("named");
	expect(completionFlag({ id: "x", flag: undefined, once: true })).toBe("event:x:done");
	expect(completionFlag({ id: "x", flag: undefined, once: false })).toBeNull();
});

test("eventAt finds an entity by tile and returns null on an empty tile", () => {
	let entities = spawnEvents([event({ id: "a", x: 5, y: 6 })], () => false);
	expect(eventAt(entities, 5, 6)?.id).toBe("a");
	expect(eventAt(entities, 0, 0)).toBeNull();
});
