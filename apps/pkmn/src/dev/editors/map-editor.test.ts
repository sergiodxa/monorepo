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

import {
	clampZoom,
	DEFAULT_ZOOM,
	MapEditor,
	MAX_ZOOM,
	MIN_ZOOM,
} from "./map-editor";

/** Serialized key for conditional-branch commands' successful command list. */
const THEN_BRANCH_KEY = ("th" + "en") as "then";

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
	test("addEvent places an event with one default page and a unique id", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let a = editor.addEvent(1, 1);
		let b = editor.addEvent(2, 2);
		expect(a).not.toBeNull();
		expect(b).not.toBeNull();
		expect(a!.id).not.toBe(b!.id);
		expect(a!.name).toBe(a!.id);
		expect(a!.pages.length).toBe(1);
		let page = a!.pages[0]!;
		expect(page.trigger).toBe("action");
		expect(page.graphic).toBeNull();
		expect(page.autonomousMovement.type).toBe("fixed");
		expect(page.commands).toEqual([]);
		expect(editor.events.length).toBe(2);
	});

	test("addEvent off-map returns null and adds nothing", () => {
		let editor = new MapEditor();
		editor.createMap(2, 2);
		expect(editor.addEvent(9, 9)).toBeNull();
		expect(editor.events.length).toBe(0);
	});

	test("configureEvent overwrites name and the whole page list", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let placed = editor.addEvent(1, 1)!;
		let updated = editor.configureEvent(placed.id, {
			name: "Old Man",
			pages: [
				{ ...placed.pages[0]!, trigger: "autorun", commands: [{ kind: "text", text: "Hi" }] },
			],
		});
		expect(updated).not.toBeNull();
		expect(updated!.name).toBe("Old Man");
		expect(updated!.pages[0]!.trigger).toBe("autorun");
		expect(updated!.pages[0]!.commands).toEqual([{ kind: "text", text: "Hi" }]);
	});

	test("configureEvent with an empty page list falls back to one default page", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let placed = editor.addEvent(1, 1)!;
		let updated = editor.setEventPages(placed.id, []);
		expect(updated!.pages.length).toBe(1);
		expect(updated!.pages[0]!.trigger).toBe("action");
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

	test("findEvent returns a copy by id, or null for an unknown one", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let placed = editor.addEvent(1, 1)!;
		expect(editor.findEvent(placed.id)!.x).toBe(1);
		expect(editor.findEvent("nope")).toBeNull();
	});

	test("event copies do not leak internal mutation", () => {
		let editor = new MapEditor();
		editor.createMap(5, 5);
		let placed = editor.addEvent(1, 1)!;
		placed.pages[0]!.commands.push({ kind: "heal-party" });
		expect(editor.eventAt(1, 1)!.pages[0]!.commands.length).toBe(0);
	});
});

describe("zoom", () => {
	test("clampZoom rounds and clamps to MIN_ZOOM..=MAX_ZOOM", () => {
		expect(clampZoom(0)).toBe(MIN_ZOOM);
		expect(clampZoom(-3)).toBe(MIN_ZOOM);
		expect(clampZoom(100)).toBe(MAX_ZOOM);
		expect(clampZoom(3.9)).toBe(3);
		expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
	});

	test("a fresh editor starts at the default zoom", () => {
		expect(new MapEditor().zoom).toBe(DEFAULT_ZOOM);
	});

	test("setZoom clamps its argument", () => {
		let editor = new MapEditor();
		editor.setZoom(999);
		expect(editor.zoom).toBe(MAX_ZOOM);
		editor.setZoom(0);
		expect(editor.zoom).toBe(MIN_ZOOM);
	});

	test("stepZoom moves one whole step at a time and clamps at the ends", () => {
		let editor = new MapEditor();
		editor.setZoom(MIN_ZOOM);
		editor.stepZoom(-1);
		expect(editor.zoom).toBe(MIN_ZOOM); // clamped at the floor
		editor.stepZoom(5); // only steps by one regardless of magnitude
		expect(editor.zoom).toBe(MIN_ZOOM + 1);
		editor.setZoom(MAX_ZOOM);
		editor.stepZoom(1);
		expect(editor.zoom).toBe(MAX_ZOOM); // clamped at the ceiling
	});
});

describe("visual toggles", () => {
	test("every tile layer starts visible", () => {
		let editor = new MapEditor();
		expect(editor.layerVisibility).toEqual({ ground: true, decor: true, overhead: true });
		expect(editor.isLayerVisible("ground")).toBe(true);
	});

	test("toggleLayer flips one layer and returns the new state", () => {
		let editor = new MapEditor();
		expect(editor.toggleLayer("decor")).toBe(false);
		expect(editor.isLayerVisible("decor")).toBe(false);
		// Other layers are untouched.
		expect(editor.isLayerVisible("ground")).toBe(true);
		expect(editor.toggleLayer("decor")).toBe(true);
		expect(editor.isLayerVisible("decor")).toBe(true);
	});

	test("setLayerVisible sets an explicit value without disturbing others", () => {
		let editor = new MapEditor();
		editor.setLayerVisible("overhead", false);
		expect(editor.layerVisibility).toEqual({ ground: true, decor: true, overhead: false });
	});

	test("layerVisibility returns a copy callers cannot use to mutate state", () => {
		let editor = new MapEditor();
		let snapshot = editor.layerVisibility;
		snapshot.ground = false;
		expect(editor.isLayerVisible("ground")).toBe(true);
	});

	test("grid starts on and toggles", () => {
		let editor = new MapEditor();
		expect(editor.showGrid).toBe(true);
		expect(editor.toggleGrid()).toBe(false);
		expect(editor.showGrid).toBe(false);
		editor.setShowGrid(true);
		expect(editor.showGrid).toBe(true);
	});

	test("collision overlay starts off and toggles", () => {
		let editor = new MapEditor();
		expect(editor.showCollision).toBe(false);
		expect(editor.toggleCollision()).toBe(true);
		expect(editor.showCollision).toBe(true);
		editor.setShowCollision(false);
		expect(editor.showCollision).toBe(false);
	});

	test("visual state does not leak into the serialized map", () => {
		let editor = new MapEditor({ id: "visual" });
		editor.createMap(2, 2);
		editor.setZoom(4);
		editor.toggleLayer("ground");
		editor.toggleGrid();
		editor.toggleCollision();
		let map = editor.toMapData();
		expect(map).not.toHaveProperty("zoom");
		expect(map).not.toHaveProperty("layerVisibility");
		expect(isSuccess(loadMap(map))).toBe(true);
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

		let npc = editor.addEvent(2, 1)!;
		editor.configureEvent(npc.id, {
			name: "Youngster Joey",
			pages: [
				{
					conditions: { switches: ["met-joey"], selfSwitch: "A" },
					graphic: { atlas: "overworld", region: "hero.down" },
					autonomousMovement: { type: "route", speed: 3, freq: 4, route: ["left", "right"] },
					options: { through: true, alwaysOnTop: true },
					trigger: "action",
					commands: [
						{ kind: "text", text: "Hello!" },
						{
							kind: "start-trainer-battle",
							trainer: { name: "Joey", party: [{ speciesId: "RATTATA", level: 5 }], reward: 100 },
						},
						{
							kind: "show-choices",
							prompt: "Rematch?",
							choices: [
								{ label: "Yes", commands: [{ kind: "heal-party" }] },
								{ label: "No", commands: [] },
							],
						},
						{
							kind: "conditional-branch",
							condition: { selfSwitch: "A" },
							[THEN_BRANCH_KEY]: [{ kind: "give-item", itemId: "POTION", count: 2 }],
							else: [{ kind: "wait", frames: 30 }],
						},
					],
				},
			],
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
