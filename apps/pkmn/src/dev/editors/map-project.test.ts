/**
 * Verifies the multi-map project lifecycle without a canvas: newMap adds a fresh map
 * and selects it, selectMap switches the active map, renameMap keeps ordering/edits
 * and rejects duplicate/invalid ids, deleteMap keeps at least one map and moves the
 * selection off a deleted active map, and — the load-bearing guarantee — each map's
 * in-progress edits stay isolated because every map is its own live {@link MapEditor}
 * (edit map A, switch to B and back → A's edits are intact and never leaked into B).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";

import { packTileRef, type Tileset } from "~/presentation/render/map-schema";

import { DEFAULT_MAP_ID, MapProject, MapProjectError, validateMapId } from "./map-project";

/** A minimal tileset declaration tests add so paint refs have something to name. */
function tileset(id: string): Tileset {
	return { id, image: id, columns: 8, tileWidth: 16, tileHeight: 16 };
}

describe("constructor", () => {
	test("starts with a single active map under the default id", () => {
		let project = new MapProject();
		expect(project.size).toBe(1);
		expect(project.mapIds()).toEqual([DEFAULT_MAP_ID]);
		expect(project.activeMapId).toBe(DEFAULT_MAP_ID);
		expect(project.active.id).toBe(DEFAULT_MAP_ID);
	});

	test("honors a supplied id and dimensions for the first map", () => {
		let project = new MapProject({ id: "town", width: 8, height: 6 });
		expect(project.mapIds()).toEqual(["town"]);
		expect(project.active.width).toBe(8);
		expect(project.active.height).toBe(6);
	});

	test("falls back to the default id when the supplied one is invalid", () => {
		let project = new MapProject({ id: "Not Valid" });
		expect(project.activeMapId).toBe(DEFAULT_MAP_ID);
	});
});

describe("newMap", () => {
	test("adds a fresh map at the end and selects it", () => {
		let project = new MapProject({ id: "a" });
		let result = project.newMap("b", 5, 4);
		expect(isSuccess(result)).toBe(true);
		expect(project.mapIds()).toEqual(["a", "b"]);
		expect(project.activeMapId).toBe("b");
		expect(project.active.width).toBe(5);
		expect(project.active.height).toBe(4);
	});

	test("rejects a duplicate id without adding or switching", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");
		let result = project.newMap("a");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MapProjectError);
		expect(project.mapIds()).toEqual(["a", "b"]);
		expect(project.activeMapId).toBe("b");
	});

	test("rejects an invalid id", () => {
		let project = new MapProject({ id: "a" });
		let result = project.newMap("Bad Id");
		expect(isFailure(result)).toBe(true);
		expect(project.size).toBe(1);
	});
});

describe("selectMap", () => {
	test("switches the active map to an existing id", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");
		let result = project.selectMap("a");
		expect(isSuccess(result)).toBe(true);
		expect(project.activeMapId).toBe("a");
	});

	test("rejects an unknown id and leaves the selection unchanged", () => {
		let project = new MapProject({ id: "a" });
		let result = project.selectMap("missing");
		expect(isFailure(result)).toBe(true);
		expect(project.activeMapId).toBe("a");
	});
});

describe("renameMap", () => {
	test("renames a map, keeping its tree position and live editor", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");
		project.newMap("c");
		// Give "b" some content so we can prove the editor is the same instance after rename.
		project.selectMap("b");
		project.active.addTileset(tileset("x"));
		project.active.addEvent(1, 1);

		let result = project.renameMap("b", "bee");
		expect(isSuccess(result)).toBe(true);
		expect(project.mapIds()).toEqual(["a", "bee", "c"]);
		expect(project.activeMapId).toBe("bee");
		expect(project.active.id).toBe("bee");
		expect(project.active.tilesets.length).toBe(1);
		expect(project.active.events.length).toBe(1);
	});

	test("rejects renaming onto another existing id", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");
		let result = project.renameMap("a", "b");
		expect(isFailure(result)).toBe(true);
		expect(project.mapIds()).toEqual(["a", "b"]);
	});

	test("rejects an invalid new id", () => {
		let project = new MapProject({ id: "a" });
		let result = project.renameMap("a", "Bad Id");
		expect(isFailure(result)).toBe(true);
		expect(project.mapIds()).toEqual(["a"]);
	});

	test("rejects renaming an unknown map", () => {
		let project = new MapProject({ id: "a" });
		let result = project.renameMap("missing", "b");
		expect(isFailure(result)).toBe(true);
	});

	test("renaming to the same id is a no-op success", () => {
		let project = new MapProject({ id: "a" });
		let result = project.renameMap("a", "a");
		expect(isSuccess(result)).toBe(true);
		expect(project.mapIds()).toEqual(["a"]);
	});
});

describe("deleteMap", () => {
	test("removes a map and moves the selection off the deleted active map", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");
		project.newMap("c");
		project.selectMap("b");

		let result = project.deleteMap("b");
		expect(isSuccess(result)).toBe(true);
		expect(project.mapIds()).toEqual(["a", "c"]);
		// The neighbor after the deleted one becomes active.
		expect(project.activeMapId).toBe("c");
	});

	test("falls back to the previous neighbor when deleting the last map in order", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");
		project.selectMap("b");
		project.deleteMap("b");
		expect(project.activeMapId).toBe("a");
	});

	test("keeps the active map when deleting a different one", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");
		project.selectMap("a");
		project.deleteMap("b");
		expect(project.activeMapId).toBe("a");
		expect(project.mapIds()).toEqual(["a"]);
	});

	test("refuses to remove the last map", () => {
		let project = new MapProject({ id: "a" });
		let result = project.deleteMap("a");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MapProjectError);
		expect(project.size).toBe(1);
	});

	test("rejects deleting an unknown map", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");
		let result = project.deleteMap("missing");
		expect(isFailure(result)).toBe(true);
		expect(project.size).toBe(2);
	});
});

describe("edit isolation", () => {
	test("edits on one map survive switching to another and back", () => {
		let project = new MapProject({ id: "a", width: 4, height: 4 });
		project.newMap("b", 4, 4);

		// Paint a tile on map A.
		project.selectMap("a");
		project.active.addTileset(tileset("a-set"));
		project.active.setLayer("ground");
		project.active.paintTile("ground", 1, 1);
		let painted = packTileRef(0, 0);
		expect(project.active.cellAt("ground", 1, 1)).toBe(painted);

		// Switch to B: its grid must be untouched (no tileset, empty cell).
		project.selectMap("b");
		expect(project.active.tilesets.length).toBe(0);
		expect(project.active.cellAt("ground", 1, 1)).not.toBe(painted);
		// Edit B independently.
		project.active.addTileset(tileset("b-set"));
		project.active.paintTile("ground", 2, 2);

		// Back to A: its paint is intact and B's edit did not leak in.
		project.selectMap("a");
		expect(project.active.cellAt("ground", 1, 1)).toBe(painted);
		expect(project.active.cellAt("ground", 2, 2)).not.toBe(painted);
		expect(project.active.tilesets.map((set) => set.id)).toEqual(["a-set"]);
	});

	test("per-map UI state (tool/selection) does not leak across maps", () => {
		let project = new MapProject({ id: "a" });
		project.newMap("b");

		project.selectMap("a");
		project.active.setTool("fill");
		project.active.setLayer("collision");

		project.selectMap("b");
		// B keeps its own defaults, unaffected by A's tool/layer choice.
		expect(project.active.tool).toBe("paint");
		expect(project.active.layer).toBe("ground");
	});
});

describe("validateMapId", () => {
	test("accepts a lowercase slug and trims it", () => {
		let result = validateMapId("  route-1  ");
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("route-1");
	});

	let bad: Array<[label: string, id: string]> = [
		["blank", ""],
		["uppercase", "Route"],
		["space", "route 1"],
		["underscore", "route_1"],
		["leading hyphen", "-route"],
		["trailing hyphen", "route-"],
		["over 64 chars", "a".repeat(65)],
	];
	for (let [label, id] of bad) {
		test(`rejects ${label}`, () => {
			expect(isFailure(validateMapId(id))).toBe(true);
		});
	}
});
