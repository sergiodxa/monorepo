/**
 * Verifies the pure map-editor logic without a canvas: creating and resizing the
 * map (layers/collision stay `width * height`, resize preserves the overlap),
 * tileset add/remove (removal clears and reindexes packed refs), painting/erasing
 * and flood-filling tile layers and the collision grid, event add/configure/move/
 * remove, and that {@link MapEditor.toMapData} produces a schema-valid map that
 * round-trips through `loadMap`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { isSuccess } from "@pkg/result";

import { loadMap } from "~/presentation/overworld/map-loader";
import {
	EMPTY_CELL,
	packTileRef,
	type Tileset,
	unpackTileRef,
} from "~/presentation/render/map-schema";
import { Collision } from "~/presentation/render/tilemap";

import { MapEditor } from "./map-editor";

/** A minimal tileset declaration tests add to give paint refs something to name. */
function tileset(id: string): Tileset {
	return { id, image: id, columns: 8, tileWidth: 16, tileHeight: 16 };
}

describe("createMap", () => {
	test("sizes every layer and the collision grid to width * height", () => {
		let editor = new MapEditor();
		editor.createMap(6, 4);
		expect(editor.width).toBe(6);
		expect(editor.height).toBe(4);
		expect(editor.cellCount).toBe(24);

		let map = editor.toMapData();
		expect(map.layers.ground.length).toBe(24);
		expect(map.layers.decor.length).toBe(24);
		expect(map.layers.overhead.length).toBe(24);
		expect(map.collision.length).toBe(24);
		expect(map.layers.ground.every((cell) => cell === EMPTY_CELL)).toBe(true);
		expect(map.collision.every((cell) => cell === Collision.Walkable)).toBe(true);
	});

	test("clamps a non-positive or fractional dimension to a whole >= 1", () => {
		let editor = new MapEditor();
		editor.createMap(0, 3.7);
		expect(editor.width).toBe(1);
		expect(editor.height).toBe(3);
	});

	test("carries a custom tile size through", () => {
		let editor = new MapEditor();
		editor.createMap(4, 4, 32, 24);
		expect(editor.tileWidth).toBe(32);
		expect(editor.tileHeight).toBe(24);
	});
});

describe("resize", () => {
	test("preserves the overlapping top-left region and fills new cells", () => {
		let editor = new MapEditor();
		editor.createMap(3, 3);
		editor.addTileset(tileset("a"));
		editor.selectTile(0, 5);
		editor.paintTile("ground", 0, 0);
		editor.paintTile("ground", 2, 2);
		editor.paintCollision(1, 1, Collision.Solid);

		editor.resize(4, 4);
		expect(editor.width).toBe(4);
		// The (0,0) tile is preserved; the (2,2) tile is preserved too.
		expect(editor.cellAt("ground", 0, 0)).toBe(packTileRef(0, 5));
		expect(editor.cellAt("ground", 2, 2)).toBe(packTileRef(0, 5));
		expect(editor.collisionAt(1, 1)).toBe(Collision.Solid);
		// A newly exposed cell is empty / walkable.
		expect(editor.cellAt("ground", 3, 3)).toBe(EMPTY_CELL);
		expect(editor.collisionAt(3, 3)).toBe(Collision.Walkable);
	});

	test("drops events that fall outside the new bounds", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		editor.addEvent(1, 1);
		editor.addEvent(4, 4);
		editor.resize(3, 3);
		let events = editor.events;
		expect(events.length).toBe(1);
		expect(events[0]!.x).toBe(1);
	});
});

describe("tilesets", () => {
	test("addTileset returns the new index and appends in order", () => {
		let editor = new MapEditor();
		expect(editor.addTileset(tileset("a"))).toBe(0);
		expect(editor.addTileset(tileset("b"))).toBe(1);
		expect(editor.tilesets.map((t) => t.id)).toEqual(["a", "b"]);
	});

	test("removeTileset clears refs to it and reindexes later refs down", () => {
		let editor = new MapEditor();
		editor.createMap(3, 1);
		editor.addTileset(tileset("a"));
		editor.addTileset(tileset("b"));
		editor.addTileset(tileset("c"));
		editor.selectTile(0, 1);
		editor.paintTile("ground", 0, 0); // tileset 0
		editor.selectTile(1, 2);
		editor.paintTile("ground", 1, 0); // tileset 1 (removed)
		editor.selectTile(2, 3);
		editor.paintTile("ground", 2, 0); // tileset 2 -> becomes 1

		editor.removeTileset(1);
		expect(editor.tilesets.map((t) => t.id)).toEqual(["a", "c"]);
		expect(editor.cellAt("ground", 0, 0)).toBe(packTileRef(0, 1));
		expect(editor.cellAt("ground", 1, 0)).toBe(EMPTY_CELL);
		expect(unpackTileRef(editor.cellAt("ground", 2, 0))).toEqual({ tilesetIndex: 1, tileIndex: 3 });
	});
});

describe("painting tile layers", () => {
	test("paintTile packs the selected ref onto the active layer", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		editor.addTileset(tileset("a"));
		editor.selectTile(0, 7);
		editor.paintTile("decor", 1, 0);
		expect(editor.cellAt("decor", 1, 0)).toBe(packTileRef(0, 7));
		// Other layers are untouched.
		expect(editor.cellAt("ground", 1, 0)).toBe(EMPTY_CELL);
	});

	test("paintTile is a no-op with no tileset declared", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		editor.paintTile("ground", 0, 0);
		expect(editor.cellAt("ground", 0, 0)).toBe(EMPTY_CELL);
	});

	test("setCell refuses a ref naming an undeclared tileset", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		editor.addTileset(tileset("a"));
		editor.setCell("ground", 0, 0, packTileRef(3, 0));
		expect(editor.cellAt("ground", 0, 0)).toBe(EMPTY_CELL);
	});

	test("eraseTile clears a cell to EMPTY_CELL", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		editor.addTileset(tileset("a"));
		editor.selectTile(0, 2);
		editor.paintTile("ground", 0, 0);
		editor.eraseTile("ground", 0, 0);
		expect(editor.cellAt("ground", 0, 0)).toBe(EMPTY_CELL);
	});

	test("painting off-map is ignored", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		editor.addTileset(tileset("a"));
		editor.selectTile(0, 0);
		editor.paintTile("ground", 5, 5);
		expect(editor.toMapData().layers.ground.every((cell) => cell === EMPTY_CELL)).toBe(true);
	});
});

describe("collision", () => {
	test("paintCollision writes the value at the tile", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		editor.paintCollision(1, 1, Collision.Water);
		expect(editor.collisionAt(1, 1)).toBe(Collision.Water);
	});
});

describe("fill", () => {
	test("fillTile flood-fills the contiguous empty region on a layer", () => {
		let editor = new MapEditor();
		editor.createMap(3, 3);
		editor.addTileset(tileset("a"));
		editor.selectTile(0, 4);
		let changed = editor.fillTile("ground", 0, 0);
		expect(changed).toBe(9);
		expect(editor.toMapData().layers.ground.every((cell) => cell === packTileRef(0, 4))).toBe(true);
	});

	test("fill stops at a differing boundary", () => {
		let editor = new MapEditor();
		editor.createMap(3, 1);
		editor.addTileset(tileset("a"));
		editor.selectTile(0, 1);
		editor.setCell("ground", 1, 0, packTileRef(0, 9)); // wall in the middle
		let changed = editor.fillTile("ground", 0, 0);
		expect(changed).toBe(1); // only the seed cell
		expect(editor.cellAt("ground", 2, 0)).toBe(EMPTY_CELL);
	});

	test("fill on collision floods the collision grid", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		let changed = editor.fill("collision", 0, 0, Collision.Solid);
		expect(changed).toBe(4);
		expect(editor.toMapData().collision.every((cell) => cell === Collision.Solid)).toBe(true);
	});

	test("fill is a no-op when the seed already holds the value", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		expect(editor.fill("collision", 0, 0, Collision.Walkable)).toBe(0);
	});
});

describe("events", () => {
	test("addEvent places an event with defaults and a unique id", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let a = editor.addEvent(1, 1, "npc");
		let b = editor.addEvent(2, 2, "npc");
		expect(a).not.toBeNull();
		expect(b).not.toBeNull();
		expect(a!.id).not.toBe(b!.id);
		expect(a!.kind).toBe("npc");
		expect(a!.interactionMode).toBe("action");
		expect(a!.movement).toBe("none");
		expect(a!.sprite).toBeNull();
		expect(editor.events.length).toBe(2);
	});

	test("addEvent off-map returns null and adds nothing", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		expect(editor.addEvent(9, 9)).toBeNull();
		expect(editor.events.length).toBe(0);
	});

	test("configureEvent merges a patch, deep-merging interaction", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let placed = editor.addEvent(1, 1, "trigger")!;
		let updated = editor.configureEvent(placed.id, {
			interactionMode: "touch",
			interaction: {
				script: [{ do: "message", text: "Hi" }],
				trainer: undefined,
				wild: undefined,
			},
		});
		expect(updated).not.toBeNull();
		expect(updated!.interactionMode).toBe("touch");
		expect(updated!.interaction.script).toEqual([{ do: "message", text: "Hi" }]);
	});

	test("moveEvent relocates within bounds and ignores off-map", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let placed = editor.addEvent(1, 1)!;
		editor.moveEvent(placed.id, 3, 4);
		expect(editor.eventAt(3, 4)!.id).toBe(placed.id);
		editor.moveEvent(placed.id, 99, 99);
		expect(editor.eventAt(3, 4)!.id).toBe(placed.id); // unchanged
	});

	test("removeEvent drops the event by id", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let placed = editor.addEvent(1, 1)!;
		editor.removeEvent(placed.id);
		expect(editor.events.length).toBe(0);
	});

	test("event copies do not leak internal mutation", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let placed = editor.addEvent(1, 1)!;
		placed.interaction.script.push({ do: "heal-party" });
		expect(editor.eventAt(1, 1)!.interaction.script.length).toBe(0);
	});
});

describe("toMapData round-trips through loadMap", () => {
	test("a painted map with events validates", () => {
		let editor = new MapEditor({ id: "test-map" });
		editor.createMap(4, 3, 16, 16);
		editor.addTileset(tileset("overworld"));
		editor.selectTile(0, 0);
		editor.fillTile("ground", 0, 0);
		editor.selectTile(0, 3);
		editor.paintTile("decor", 1, 1);
		editor.paintCollision(0, 0, Collision.Solid);

		let npc = editor.addEvent(2, 1, "npc")!;
		editor.configureEvent(npc.id, {
			facing: "left",
			sprite: { atlas: "overworld", region: "hero.down" },
			movement: { type: "route", steps: ["left", "right"] },
			interaction: {
				script: [{ do: "message", text: "Hello!" }],
				trainer: { name: "Joey", party: [{ speciesId: "RATTATA", level: 5 }], reward: 100 },
				wild: undefined,
			},
		});

		let map = editor.toMapData();
		expect(map.id).toBe("test-map");
		let loaded = loadMap(map);
		expect(isSuccess(loaded)).toBe(true);
	});

	test("an empty map with no tilesets still validates", () => {
		let editor = new MapEditor({ id: "empty" });
		editor.createMap(2, 2);
		expect(isSuccess(loadMap(editor.toMapData()))).toBe(true);
	});

	test("trims the id and bgm on serialization", () => {
		let editor = new MapEditor({ id: "  spaced  " });
		editor.createMap(2, 2);
		editor.setBgm("  town-theme  ");
		let map = editor.toMapData();
		expect(map.id).toBe("spaced");
		expect(map.bgm).toBe("town-theme");
	});
});
