/**
 * Tests for the map JSON format's schema and its pack/unpack helpers.
 *
 * Covers the tile-ref packing round-trip (`packTileRef`/`unpackTileRef`) and the
 * `MapDataSchema` validator: a well-formed map parses (applying the documented
 * defaults for optional fields), and malformed maps — a non-object, a missing
 * dimension, a negative tile ref, and a bad event kind — are rejected with issues.
 * Cross-field invariants (layer lengths, tileset-index bounds) live in the loader,
 * so they are covered by the loader's tests, not here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { parseSafe } from "remix/data-schema";

import {
	EMPTY_CELL,
	MapDataSchema,
	packTileRef,
	TILESET_STRIDE,
	unpackTileRef,
} from "./map-schema";

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

test("a fully populated event parses with its rich config preserved", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({
			events: [
				{
					id: "e1",
					x: 1,
					y: 0,
					kind: "npc",
					facing: "left",
					sprite: { atlas: "overworld", region: "hero.down.0" },
					movement: { type: "route", steps: ["left", "right"] },
					interactionMode: "touch",
					once: true,
					flag: "met-e1",
					interaction: {
						script: [{ do: "message", text: "hi" }],
						trainer: { name: "Joey", party: [{ speciesId: "rattata", level: 5 }], reward: 400 },
					},
				},
			],
		}),
	);
	expect(result.success).toBe(true);
	if (!result.success) return;
	let event = result.value.events[0]!;
	expect(event.kind).toBe("npc");
	expect(event.movement).toEqual({ type: "route", steps: ["left", "right"] });
	expect(event.interaction.trainer?.party).toEqual([{ speciesId: "rattata", level: 5 }]);
	expect(event.interactionMode).toBe("touch");
});

test("an event with only its required fields gets defaulted sprite/movement/interaction", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({ events: [{ id: "t1", x: 0, y: 0, kind: "trigger" }] }),
	);
	expect(result.success).toBe(true);
	if (!result.success) return;
	let event = result.value.events[0]!;
	expect(event.sprite).toBeNull();
	expect(event.movement).toBe("none");
	expect(event.facing).toBe("down");
	expect(event.interactionMode).toBe("action");
	expect(event.once).toBe(false);
	expect(event.interaction.script).toEqual([]);
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

test("an unknown event kind is rejected", () => {
	let result = parseSafe(
		MapDataSchema,
		validMap({ events: [{ id: "e", x: 0, y: 0, kind: "boss" }] }),
	);
	expect(result.success).toBe(false);
});
