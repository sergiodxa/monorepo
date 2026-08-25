/**
 * Verifies the map export: the pure shaper derives the write path, the served
 * URL, and a tab-indented JSON body from a validated map, and rejects invalid
 * ids before any path work; the derived path always passes the shared
 * path-safety guard; and manifest registration adds the map to a copy.
 * {@link runMapExport} runs end to end against a scratch target it cleans up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { isFailure, isSuccess } from "@pkg/result";
import { afterAll, describe, expect, test } from "vitest";

import { EMPTY_CELL, type MapData } from "~/presentation/render/map-schema";
import { Collision } from "~/presentation/render/tilemap";

import { APP_ROOT, MANIFEST_PATH } from "./export";
import {
	MAP_CONTENT_DIR,
	MAP_URL_PREFIX,
	MapIdError,
	registerMap,
	runMapExport,
	shapeMapExport,
} from "./map-export";
import { validateWritePath } from "./path-safety";

/** A minimal, valid 2x2 map tests clone and mutate to exercise one rule. */
function validMap(): MapData {
	let cells = 4;
	return {
		id: "test-route",
		width: 2,
		height: 2,
		tileWidth: 16,
		tileHeight: 16,
		tilesets: [{ id: "overworld", image: "overworld", columns: 8, tileWidth: 16, tileHeight: 16 }],
		layers: {
			ground: Array.from({ length: cells }, () => 0),
			decor: Array.from({ length: cells }, () => EMPTY_CELL),
			overhead: Array.from({ length: cells }, () => EMPTY_CELL),
		},
		collision: Array.from({ length: cells }, () => Collision.Walkable),
		encounters: [],
		warps: [],
		events: [],
		bgm: "",
	};
}

describe("shapeMapExport", () => {
	test("derives the path, url, and a tab-indented JSON body from the id", () => {
		let result = shapeMapExport(validMap());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.id).toBe("test-route");
			expect(result.data.path).toBe(`${MAP_CONTENT_DIR}/test-route.json`);
			expect(result.data.url).toBe(`${MAP_URL_PREFIX}/test-route.json`);
			expect(result.data.contents.endsWith("\n")).toBe(true);
			expect(result.data.contents).toContain("\t");
			expect(JSON.parse(result.data.contents)).toEqual(validMap());
		}
	});

	test("trims the id for the path and the serialized body", () => {
		let result = shapeMapExport({ ...validMap(), id: "  test-route  " });
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.path).toBe(`${MAP_CONTENT_DIR}/test-route.json`);
			expect((JSON.parse(result.data.contents) as MapData).id).toBe("test-route");
		}
	});

	test("the derived path always passes the path-safety guard", () => {
		let result = shapeMapExport(validMap());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(isSuccess(validateWritePath(result.data.path))).toBe(true);
	});

	describe("rejects invalid ids", () => {
		let cases: Array<[label: string, id: string]> = [
			["blank", ""],
			["whitespace only", "   "],
			["uppercase", "Route"],
			["underscore", "route_1"],
			["space", "route 1"],
			["leading hyphen", "-route"],
			["trailing hyphen", "route-"],
			["dot / extension", "route.json"],
			["slash / traversal", "../route"],
			["nested slash", "sub/route"],
			["over 64 chars", "a".repeat(65)],
		];

		for (let [label, id] of cases) {
			test(label, () => {
				let result = shapeMapExport({ ...validMap(), id });
				expect(isFailure(result)).toBe(true);
				if (isFailure(result)) expect(result.error).toBeInstanceOf(MapIdError);
			});
		}
	});
});

describe("registerMap", () => {
	test("adds the map under maps by id → url", () => {
		let manifest = { images: {}, audio: {}, maps: {}, atlases: {} };
		let next = registerMap(manifest, {
			id: "town",
			path: "src/content/maps/town.json",
			url: "/content/maps/town.json",
			contents: "",
		});
		expect(next.maps).toEqual({ town: "/content/maps/town.json" });
	});

	test("preserves existing maps and other manifest kinds without mutating input", () => {
		let manifest = {
			images: { hero: "/assets/hero.png" },
			maps: { "route-1": "/content/maps/route-1.json" },
			atlases: {},
		};
		let next = registerMap(manifest, {
			id: "town",
			path: "src/content/maps/town.json",
			url: "/content/maps/town.json",
			contents: "",
		});
		expect(next.maps).toEqual({
			"route-1": "/content/maps/route-1.json",
			town: "/content/maps/town.json",
		});
		expect(next.images).toEqual({ hero: "/assets/hero.png" });
		expect(manifest.maps).toEqual({ "route-1": "/content/maps/route-1.json" });
	});
});

describe("runMapExport", () => {
	let SCRATCH_ID = "export-test-map";
	let SCRATCH_PATH = `${MAP_CONTENT_DIR}/${SCRATCH_ID}.json`;
	let MANIFEST_ABS = resolve(APP_ROOT, MANIFEST_PATH);
	let manifestBackup: string | null = null;

	afterAll(async () => {
		await rm(resolve(APP_ROOT, SCRATCH_PATH), { force: true });
		if (manifestBackup !== null) await writeFile(MANIFEST_ABS, manifestBackup);
	});

	test("rejects a malformed map without writing", async () => {
		let result = await runMapExport({ id: SCRATCH_ID, width: 2, height: 2 });
		expect(isFailure(result)).toBe(true);
	});

	test("rejects a map whose layer length disagrees with the size", async () => {
		let bad = { ...validMap(), id: SCRATCH_ID };
		bad.layers = { ...bad.layers, ground: [0] };
		let result = await runMapExport(bad);
		expect(isFailure(result)).toBe(true);
	});

	test("rejects an invalid id with a MapIdError", async () => {
		let result = await runMapExport({ ...validMap(), id: "Bad Id" });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MapIdError);
	});

	test("validates, writes the JSON, and registers the map in the manifest", async () => {
		manifestBackup = await readFile(MANIFEST_ABS, "utf8");
		let map = { ...validMap(), id: SCRATCH_ID };
		let result = await runMapExport(map);
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.path).toBe(SCRATCH_PATH);
			expect(result.data.url).toBe(`${MAP_URL_PREFIX}/${SCRATCH_ID}.json`);
			expect(result.data.bytesWritten).toBeGreaterThan(0);

			let written = JSON.parse(await readFile(result.data.absolutePath, "utf8"));
			expect(written).toEqual(map);

			let manifest = JSON.parse(await readFile(MANIFEST_ABS, "utf8")) as {
				maps: Record<string, string>;
			};
			expect(manifest.maps[SCRATCH_ID]).toBe(`${MAP_URL_PREFIX}/${SCRATCH_ID}.json`);
		}
	});
});
