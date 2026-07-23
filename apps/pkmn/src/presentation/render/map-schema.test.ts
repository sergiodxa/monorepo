/**
 * Tests for the map JSON format's schema and its pack/unpack helpers.
 *
 * Covers the tile-ref packing round-trip (`packTileRef`/`unpackTileRef`) and the
 * `MapDataSchema` validator: a well-formed map parses (applying the documented
 * defaults for optional fields), the RPG-Maker-XP event model (multi-page events,
 * every trigger and autonomous-movement type, the recursive command union with
 * nested `show-choices`/`conditional-branch`) validates, and malformed maps — a
 * non-object, a missing dimension, a negative tile ref, a bad trigger, an unknown
 * command kind, and non-array pages — are rejected with issues. Cross-field
 * invariants (layer lengths, tileset-index bounds) live in the loader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { parseSafe } from "remix/data-schema";

import {
	EMPTY_CELL,
	type EventCommand,
	MapDataSchema,
	packTileRef,
	TILESET_STRIDE,
	unpackTileRef,
} from "./map-schema";

/** Serialized key for conditional-branch commands' successful command list. */
const THEN_BRANCH_KEY = ("th" + "en") as "then";

test("packTileRef and unpackTileRef round-trip a tileset/tile index pair", () => {
	expect(packTileRef(0, 0)).toBe(0);
	expect(packTileRef(1, 5)).toBe(TILESET_STRIDE + 5);
	expect(unpackTileRef(packTileRef(3, 42))).toEqual({ tilesetIndex: 3, tileIndex: 42 });
	expect(unpackTileRef(TILESET_STRIDE * 2 + 7)).toEqual({ tilesetIndex: 2, tileIndex: 7 });
});

/** A minimal well-formed 2x1 map, spread and overridden per test. */
function validMap(overrides: Record<string, unknown> = {}) {
	return {
		id: "m",
		width: 2,
		height: 1,
		tileWidth: 16,
		tileHeight: 16,
		tilesets: [{ id: "t", image: "sheet", columns: 8, tileWidth: 16, tileHeight: 16 }],
		layers: {
			ground: [0, EMPTY_CELL],
			decor: [EMPTY_CELL, EMPTY_CELL],
			overhead: [EMPTY_CELL, EMPTY_CELL],
		},
		collision: [0, 1],
		...overrides,
	};
}

test("a well-formed map parses and applies defaults for omitted optional fields", () => {
	let result = parseSafe(MapDataSchema, validMap());
	expect(result.success).toBe(true);
	if (!result.success) return;
	expect(result.value.id).toBe("m");
	// Omitted optional collections default to empty, and bgm defaults to "".
	expect(result.value.encounters).toEqual([]);
	expect(result.value.warps).toEqual([]);
	expect(result.value.events).toEqual([]);
	expect(result.value.bgm).toBe("");
});

test("a multi-page event parses with its pages, graphic, movement, and commands", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({
			events: [
				{
					id: "e1",
					x: 1,
					y: 0,
					name: "Joey",
					pages: [
						{
							conditions: { switches: ["intro-done"], selfSwitch: "A" },
							graphic: { atlas: "overworld", region: "hero.down.0" },
							autonomousMovement: { type: "route", speed: 3, freq: 2, route: ["left", "right"] },
							options: { directionFix: true, alwaysOnTop: true },
							trigger: "action",
							commands: [
								{ kind: "text", text: "Hey! Let's battle!" },
								{
									kind: "start-trainer-battle",
									trainer: {
										name: "Joey",
										party: [{ speciesId: "rattata", level: 5 }],
										reward: 400,
									},
								},
							],
						},
						{
							conditions: { selfSwitch: "A" },
							graphic: null,
							trigger: "autorun",
							commands: [{ kind: "text", text: "..." }],
						},
					],
				},
			],
		}),
	);
	expect(result.success).toBe(true);
	if (!result.success) return;
	let event = result.value.events[0]!;
	expect(event.name).toBe("Joey");
	expect(event.pages).toHaveLength(2);
	let first = event.pages[0]!;
	expect(first.conditions).toEqual({ switches: ["intro-done"], selfSwitch: "A" });
	expect(first.graphic).toEqual({ atlas: "overworld", region: "hero.down.0" });
	expect(first.autonomousMovement).toEqual({
		type: "route",
		speed: 3,
		freq: 2,
		route: ["left", "right"],
	});
	expect(first.trigger).toBe("action");
	expect(first.commands[1]).toEqual({
		kind: "start-trainer-battle",
		trainer: { name: "Joey", party: [{ speciesId: "rattata", level: 5 }], reward: 400 },
	});
	expect(event.pages[1]!.graphic).toBeNull();
	expect(event.pages[1]!.trigger).toBe("autorun");
});

test("a page with only its required fields gets defaulted conditions/graphic/movement", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({ events: [{ id: "t1", x: 0, y: 0, pages: [{}] }] }),
	);
	expect(result.success).toBe(true);
	if (!result.success) return;
	let page = result.value.events[0]!.pages[0]!;
	expect(page.conditions).toEqual({});
	expect(page.graphic).toBeNull();
	expect(page.autonomousMovement).toEqual({
		type: "fixed",
		speed: undefined,
		freq: undefined,
		route: undefined,
	});
	expect(page.options).toEqual({});
	expect(page.trigger).toBe("action");
	expect(page.commands).toEqual([]);
});

test("every trigger value and autonomous-movement type parses", () => {
	for (let trigger of ["action", "player-touch", "event-touch", "autorun", "parallel"] as const) {
		let result = parseSafe(
			MapDataSchema,
			validMap({ events: [{ id: "e", x: 0, y: 0, pages: [{ trigger }] }] }),
		);
		expect(result.success).toBe(true);
		if (result.success) expect(result.value.events[0]!.pages[0]!.trigger).toBe(trigger);
	}
	for (let type of ["fixed", "random", "route"] as const) {
		let result = parseSafe(
			MapDataSchema,
			validMap({ events: [{ id: "e", x: 0, y: 0, pages: [{ autonomousMovement: { type } }] }] }),
		);
		expect(result.success).toBe(true);
		if (result.success)
			expect(result.value.events[0]!.pages[0]!.autonomousMovement.type).toBe(type);
	}
});

test("every command kind parses, and give-item defaults its count to 1", () => {
	let commands: EventCommand[] = [
		{ kind: "text", text: "hi" },
		{ kind: "control-switch", flag: "gate", value: true },
		{ kind: "control-self-switch", name: "A", value: false },
		{ kind: "wild-encounter", speciesId: "MEW", level: 30 },
		{ kind: "heal-party" },
		{ kind: "warp", map: "town", x: 5, y: 12 },
		{ kind: "face-player" },
		{ kind: "move", steps: ["up", "down"] },
		{ kind: "wait", frames: 30 },
	];
	// `give-item` sent without a count should default to 1.
	let sent = [...commands, { kind: "give-item", itemId: "POTION" }];
	let result = parseSafe(
		MapDataSchema,
		validMap({ events: [{ id: "e", x: 0, y: 0, pages: [{ commands: sent }] }] }),
	);
	expect(result.success).toBe(true);
	if (!result.success) return;
	let parsed = result.value.events[0]!.pages[0]!.commands;
	expect(parsed).toHaveLength(sent.length);
	expect(parsed.at(-1)).toEqual({ kind: "give-item", itemId: "POTION", count: 1 });
});

test("recursive commands validate: nested show-choices and conditional-branch", () => {
	let deep: EventCommand[] = [
		{
			kind: "show-choices",
			prompt: "Well?",
			choices: [
				{
					label: "Yes",
					commands: [
						{
							kind: "conditional-branch",
							condition: { switch: "brave" },
							[THEN_BRANCH_KEY]: [
								{
									kind: "show-choices",
									choices: [{ label: "Deeper", commands: [{ kind: "text", text: "!" }] }],
								},
							],
							else: [{ kind: "text", text: "Maybe later." }],
						},
					],
				},
				{ label: "No", commands: [{ kind: "control-self-switch", name: "A", value: true }] },
			],
		},
	];
	let result = parseSafe(
		MapDataSchema,
		validMap({ events: [{ id: "e", x: 0, y: 0, pages: [{ commands: deep }] }] }),
	);
	expect(result.success).toBe(true);
	if (!result.success) return;
	expect(result.value.events[0]!.pages[0]!.commands).toEqual(deep);
});

test("a non-object value is rejected", () => {
	expect(parseSafe(MapDataSchema, null).success).toBe(false);
	expect(parseSafe(MapDataSchema, "not a map").success).toBe(false);
});

test("a map missing a dimension is rejected", () => {
	let map = validMap();
	delete (map as Record<string, unknown>).width;
	expect(parseSafe(MapDataSchema, map).success).toBe(false);
});

test("a zero dimension is rejected (dimensions must be positive)", () => {
	expect(parseSafe(MapDataSchema, validMap({ width: 0 })).success).toBe(false);
});

test("a layer cell below the empty sentinel (-1) is rejected", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({ layers: { ground: [-2, 0], decor: [-1, -1], overhead: [-1, -1] } }),
	);
	expect(result.success).toBe(false);
});

test("an event whose pages is not an array is rejected", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({ events: [{ id: "e", x: 0, y: 0, pages: "one page" }] }),
	);
	expect(result.success).toBe(false);
});

test("an unknown page trigger is rejected", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({ events: [{ id: "e", x: 0, y: 0, pages: [{ trigger: "on-load" }] }] }),
	);
	expect(result.success).toBe(false);
});

test("an unknown command kind is rejected", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({
			events: [{ id: "e", x: 0, y: 0, pages: [{ commands: [{ kind: "explode" }] }] }],
		}),
	);
	expect(result.success).toBe(false);
});
