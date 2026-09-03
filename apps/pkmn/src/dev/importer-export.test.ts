/**
 * Verifies the importer-export flow: {@link deriveImporterTarget} validates an
 * atlas id and its whole region map and derives the image target,
 * {@link registerAtlas} adds the image and every region to a copy of a manifest,
 * and a real {@link runImporterExport} round-trip writes a PNG and persists a
 * multi-region atlas, restoring the real manifest so the test leaves no trace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { AtlasExportError, type ManifestAtlases } from "./atlas-export";
import { APP_ROOT, MANIFEST_PATH } from "./export";
import { deriveImporterTarget, registerAtlas, runImporterExport } from "./importer-export";
import { SpriteNameError } from "./sprite-export";

let ONE_PX_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("deriveImporterTarget accepts valid assignments", () => {
	test("derives the image target and the full region map from the id", () => {
		let result = deriveImporterTarget({
			id: "world-tiles",
			regions: {
				"tile.0": { x: 0, y: 0, w: 16, h: 16 },
				"tile.1": { x: 16, y: 0, w: 16, h: 16 },
			},
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.image.name).toBe("world-tiles");
			expect(result.data.image.path).toBe("src/assets/world-tiles.png");
			expect(result.data.image.url).toBe("/assets/world-tiles.png");
			expect(result.data.atlasId).toBe("world-tiles");
			expect(result.data.regions).toEqual({
				"tile.0": { x: 0, y: 0, w: 16, h: 16 },
				"tile.1": { x: 16, y: 0, w: 16, h: 16 },
			});
		}
	});

	test("trims the id and allows dotted region names", () => {
		let result = deriveImporterTarget({
			id: "  hero  ",
			regions: { "hero.down": { x: 0, y: 0, w: 16, h: 32 } },
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.atlasId).toBe("hero");
	});
});

describe("deriveImporterTarget rejects invalid assignments", () => {
	let regions = { "tile.0": { x: 0, y: 0, w: 8, h: 8 } };

	test("an empty region map yields an AtlasExportError", () => {
		let result = deriveImporterTarget({ id: "atlas", regions: {} });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(AtlasExportError);
	});

	let idCases: Array<[label: string, id: string]> = [
		["empty", ""],
		["uppercase", "Atlas"],
		["underscore", "my_atlas"],
		["leading dot", ".atlas"],
		["over length", "a".repeat(65)],
	];
	for (let [label, id] of idCases) {
		test(`bad id (${label}) is rejected`, () => {
			let result = deriveImporterTarget({ id, regions });
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(
					result.error instanceof AtlasExportError || result.error instanceof SpriteNameError,
				).toBe(true);
			}
		});
	}

	test("a bad region name yields an AtlasExportError", () => {
		let result = deriveImporterTarget({
			id: "atlas",
			regions: { "Bad Region": { x: 0, y: 0, w: 8, h: 8 } },
		});
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(AtlasExportError);
	});

	let rectCases: Array<[label: string, rect: { x: number; y: number; w: number; h: number }]> = [
		["negative x", { x: -1, y: 0, w: 8, h: 8 }],
		["fractional y", { x: 0, y: 1.5, w: 8, h: 8 }],
		["zero width", { x: 0, y: 0, w: 0, h: 8 }],
		["zero height", { x: 0, y: 0, w: 8, h: 0 }],
	];
	for (let [label, rect] of rectCases) {
		test(`bad rect (${label}) yields an AtlasExportError`, () => {
			let result = deriveImporterTarget({ id: "atlas", regions: { "tile.0": rect } });
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error).toBeInstanceOf(AtlasExportError);
		});
	}
});

describe("registerAtlas", () => {
	let target = {
		image: {
			name: "world-tiles",
			path: "src/assets/world-tiles.png",
			url: "/assets/world-tiles.png",
		},
		atlasId: "world-tiles",
		regions: {
			"tile.0": { x: 0, y: 0, w: 16, h: 16 },
			"tile.1": { x: 16, y: 0, w: 16, h: 16 },
		},
	};

	test("registers the image and the whole atlas with every region", () => {
		let manifest: ManifestAtlases = { images: {}, atlases: {} };
		let next = registerAtlas(manifest, target);
		expect(next.images).toEqual({ "world-tiles": "/assets/world-tiles.png" });
		expect(next.atlases["world-tiles"]).toEqual({
			image: "/assets/world-tiles.png",
			regions: {
				"tile.0": { x: 0, y: 0, w: 16, h: 16 },
				"tile.1": { x: 16, y: 0, w: 16, h: 16 },
			},
		});
	});

	test("carries through other manifest kinds untouched", () => {
		let manifest: ManifestAtlases = {
			images: { other: "/assets/other.png" },
			audio: { theme: { url: "/audio/theme.ogg" } },
			atlases: {},
		};
		let next = registerAtlas(manifest, target);
		expect(next.images.other).toBe("/assets/other.png");
		expect(next.audio).toEqual({ theme: { url: "/audio/theme.ogg" } });
	});

	test("does not mutate the input manifest", () => {
		let manifest: ManifestAtlases = { images: {}, atlases: {} };
		registerAtlas(manifest, target);
		expect(manifest.images).toEqual({});
		expect(manifest.atlases).toEqual({});
	});
});

describe("runImporterExport", () => {
	test("rejects a malformed payload before writing", async () => {
		let result = await runImporterExport({ id: "atlas" });
		expect(isFailure(result)).toBe(true);
	});

	test("rejects a non-object regions field", async () => {
		let result = await runImporterExport({ id: "atlas", pngBase64: ONE_PX_PNG_BASE64, regions: 5 });
		expect(isFailure(result)).toBe(true);
	});

	test("rejects an empty region map before writing", async () => {
		let result = await runImporterExport({
			id: "atlas",
			pngBase64: ONE_PX_PNG_BASE64,
			regions: {},
		});
		expect(isFailure(result)).toBe(true);
	});

	test("writes the PNG and registers the full atlas in the manifest", async () => {
		let ATLAS_ID = "importer-export-test-atlas";
		let ASSET_PATH = `src/assets/${ATLAS_ID}.png`;
		let manifestFile = resolve(APP_ROOT, MANIFEST_PATH);
		let original = existsSync(manifestFile) ? await readFile(manifestFile, "utf8") : null;

		try {
			let result = await runImporterExport({
				id: ATLAS_ID,
				pngBase64: ONE_PX_PNG_BASE64,
				regions: {
					"tile.0": { x: 0, y: 0, w: 1, h: 1 },
					"tile.1": { x: 0, y: 0, w: 1, h: 1 },
				},
			});
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.id).toBe(ATLAS_ID);
				expect(result.data.path).toBe(ASSET_PATH);
				expect(result.data.url).toBe(`/assets/${ATLAS_ID}.png`);
				expect(result.data.atlasId).toBe(ATLAS_ID);
				expect(result.data.regions.sort()).toEqual(["tile.0", "tile.1"]);
				expect(result.data.bytesWritten).toBeGreaterThan(0);

				let pngBytes = new Uint8Array(await readFile(resolve(APP_ROOT, ASSET_PATH)));
				expect(Array.from(pngBytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

				let manifestText = await readFile(resolve(APP_ROOT, MANIFEST_PATH), "utf8");
				let manifest = JSON.parse(manifestText) as ManifestAtlases;
				expect(manifest.images[ATLAS_ID]).toBe(`/assets/${ATLAS_ID}.png`);
				expect(manifest.atlases[ATLAS_ID]).toEqual({
					image: `/assets/${ATLAS_ID}.png`,
					regions: {
						"tile.0": { x: 0, y: 0, w: 1, h: 1 },
						"tile.1": { x: 0, y: 0, w: 1, h: 1 },
					},
				});
			}
		} finally {
			if (original !== null) await writeFile(resolve(APP_ROOT, MANIFEST_PATH), original);
			await rm(resolve(APP_ROOT, ASSET_PATH), { force: true });
		}
	});
});
