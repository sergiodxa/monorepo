/**
 * Verifies spawning live entities from a map's authored events and picking the
 * active page under the current flags.
 *
 * Spawning is the pure enter-a-map step: every event becomes an entity at its
 * authored tile with its active page pre-selected. Page selection follows the
 * RPG-Maker-XP model — the *last* page whose `conditions` (global switches and an
 * optional self-switch) currently hold is the active one, and an event with no
 * qualifying page spawns inert (`page` null) so a later flag change can flip it on
 * without a respawn. `refreshActivePages` re-runs that selection in place, and
 * `eventAt` finds the entity occupying a tile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { EventPage, MapEvent } from "../render/map-schema";

import {
	eventAt,
	refreshActivePages,
	selectActivePage,
	selfSwitchFlag,
	spawnEvents,
} from "./event-runtime";

/** The map id every fixture event belongs to. */
const MAP_ID = "route-1";

/** Builds one event page, defaulting every field the tests do not exercise. */
function page(overrides: Partial<EventPage> = {}): EventPage {
	return {
		conditions: {},
		graphic: null,
		autonomousMovement: { type: "fixed", speed: undefined, freq: undefined, route: undefined },
		options: {},
		trigger: "action",
		commands: [],
		...overrides,
	};
}

/** Builds one authored event with sensible defaults for the fields under test. */
function event(overrides: Partial<MapEvent> & Pick<MapEvent, "id">): MapEvent {
	return {
		x: 0,
		y: 0,
		name: undefined,
		pages: [page()],
		...overrides,
	};
}

test("selectActivePage picks the last page whose switch conditions all hold", () => {
	let e = event({
		id: "npc",
		pages: [
			page({ commands: [{ kind: "text", text: "base" }] }),
			page({
				conditions: { switches: ["got-badge"] },
				commands: [{ kind: "text", text: "gated" }],
			}),
		],
	});

	// The gated page qualifies only once its switch is on; then it overrides the base.
	expect(selectActivePage(MAP_ID, e, () => false)).toBe(e.pages[0]!);
	expect(selectActivePage(MAP_ID, e, (flag) => flag === "got-badge")).toBe(e.pages[1]!);
});

test("selectActivePage requires every switch in a page's list to hold", () => {
	let e = event({
		id: "npc",
		pages: [page(), page({ conditions: { switches: ["a", "b"] } })],
	});

	// Only one of the two switches on: the gated page fails, the base page wins.
	expect(selectActivePage(MAP_ID, e, (flag) => flag === "a")).toBe(e.pages[0]!);
	expect(selectActivePage(MAP_ID, e, (flag) => flag === "a" || flag === "b")).toBe(e.pages[1]!);
});

test("selectActivePage resolves a self-switch condition through the namespaced flag", () => {
	let e = event({
		id: "chest",
		pages: [page(), page({ conditions: { selfSwitch: "A" } })],
	});
	let openFlag = selfSwitchFlag(MAP_ID, "chest", "A");

	expect(selectActivePage(MAP_ID, e, () => false)).toBe(e.pages[0]!);
	expect(selectActivePage(MAP_ID, e, (flag) => flag === openFlag)).toBe(e.pages[1]!);
});

test("selectActivePage returns null when no page's conditions hold", () => {
	let e = event({ id: "gated", pages: [page({ conditions: { switches: ["never"] } })] });
	expect(selectActivePage(MAP_ID, e, () => false)).toBeNull();
});

test("spawnEvents turns every event into an entity at its authored tile", () => {
	let events = [event({ id: "a", x: 3, y: 4 }), event({ id: "b", x: 7, y: 2 })];
	let entities = spawnEvents(MAP_ID, events, () => false);

	expect(entities).toHaveLength(2);
	expect(entities[0]).toMatchObject({ mapId: MAP_ID, id: "a", x: 3, y: 4, facing: "down" });
	expect(entities[1]).toMatchObject({ mapId: MAP_ID, id: "b", x: 7, y: 2 });
});

test("spawnEvents pre-selects each entity's active page from the current flags", () => {
	let events = [
		event({
			id: "npc",
			pages: [page(), page({ conditions: { switches: ["on"] } })],
		}),
	];

	// Flag off: the base page is active. Flag on: the gated page wins.
	expect(spawnEvents(MAP_ID, events, () => false)[0]!.page).toBe(events[0]!.pages[0]!);
	expect(spawnEvents(MAP_ID, events, (flag) => flag === "on")[0]!.page).toBe(events[0]!.pages[1]!);
});

test("spawnEvents still spawns an inert entity when no page qualifies", () => {
	let events = [event({ id: "gated", pages: [page({ conditions: { switches: ["never"] } })] })];
	let entities = spawnEvents(MAP_ID, events, () => false);

	expect(entities).toHaveLength(1);
	expect(entities[0]!.page).toBeNull();
});

test("refreshActivePages re-selects each entity's page in place as flags change", () => {
	let events = [
		event({
			id: "npc",
			pages: [page(), page({ conditions: { switches: ["on"] } })],
		}),
	];
	let entities = spawnEvents(MAP_ID, events, () => false);
	expect(entities[0]!.page).toBe(events[0]!.pages[0]!);

	refreshActivePages(entities, (flag) => flag === "on");
	expect(entities[0]!.page).toBe(events[0]!.pages[1]!);
});

test("eventAt finds an entity by tile and returns null on an empty tile", () => {
	let entities = spawnEvents(MAP_ID, [event({ id: "a", x: 5, y: 6 })], () => false);
	expect(eventAt(entities, 5, 6)?.id).toBe("a");
	expect(eventAt(entities, 0, 0)).toBeNull();
});
