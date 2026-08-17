/**
 * Verifies the atlas-export flow: the pure payload shaping ({@link deriveAtlasTarget}
 * validates the image name, atlas id, region name, and rect; {@link registerAtlasRegion}
 * adds the image AND the atlas region to a manifest without mutating the input or
 * clobbering unrelated entries), and a real {@link runAtlasExport} round-trip that
 * writes a PNG and persists the manifest, snapshotting and restoring the real
 * manifest so the test leaves no trace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { isFailure, isSuccess } from "@pkg/result";
import { describe, expect, test } from "vitest";

import {
	AtlasExportError,
	deriveAtlasTarget,
	type ManifestAtlases,
	registerAtlasRegion,
	runAtlasExport,
} from "./atlas-export";
import { APP_ROOT, MANIFEST_PATH } from "./export";
import { SpriteNameError } from "./sprite-export";

// A 1×1 transparent PNG, base64-encoded, used as the atlas export body.
let ONE_PX_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("deriveAtlasTarget accepts valid assignments", () => {
	test("derives the image target, atlas id, region, and rect", () => {
		let result = deriveAtlasTarget({
			name: "hero-front",
			atlasId: "characters",
			region: "hero.down",
			rect: { x: 0, y: 0, w: 16, h: 32 },
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.image.name).toBe("hero-front");
			expect(result.data.image.path).toBe("src/assets/hero-front.png");
			expect(result.data.image.url).toBe("/assets/hero-front.png");
			expect(result.data.atlasId).toBe("characters");
			expect(result.data.region).toBe("hero.down");
			expect(result.data.rect).toEqual({ x: 0, y: 0, w: 16, h: 32 });
		}
	});

	test("trims and allows dotted region/atlas names", () => {
		let result = deriveAtlasTarget({
			name: "grass",
			atlasId: "  world.tiles  ",
			region: "  tile.grass  ",
			rect: { x: 8, y: 8, w: 16, h: 16 },
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.atlasId).toBe("world.tiles");
			expect(result.data.region).toBe("tile.grass");
		}
	});
});

describe("deriveAtlasTarget rejects invalid assignments", () => {
	let base = { name: "hero", atlasId: "atlas", region: "region", rect: { x: 0, y: 0, w: 8, h: 8 } };

	test("a bad image name yields a SpriteNameError", () => {
		let result = deriveAtlasTarget({ ...base, name: "Bad Name" });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(SpriteNameError);
	});

	let atlasCases: Array<[label: string, atlasId: string]> = [
		["empty", ""],
		["uppercase", "Atlas"],
		["underscore", "my_atlas"],
		["leading dot", ".atlas"],
		["trailing dot", "atlas."],
		["over length", "a".repeat(65)],
	];
	for (let [label, atlasId] of atlasCases) {
		test(`bad atlas id (${label}) yields an AtlasExportError`, () => {
			let result = deriveAtlasTarget({ ...base, atlasId });
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error).toBeInstanceOf(AtlasExportError);
		});
	}

	test("a bad region name yields an AtlasExportError", () => {
		let result = deriveAtlasTarget({ ...base, region: "Bad Region" });
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
			let result = deriveAtlasTarget({ ...base, rect });
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error).toBeInstanceOf(AtlasExportError);
		});
	}
});

describe("registerAtlasRegion", () => {
	let target = {
		image: { name: "hero", path: "src/assets/hero.png", url: "/assets/hero.png" },
		atlasId: "characters",
		region: "hero.down",
		rect: { x: 0, y: 0, w: 16, h: 32 },
	};

	test("registers the image and creates the atlas with the region", () => {
		let manifest: ManifestAtlases = { images: {}, atlases: {} };
		let next = registerAtlasRegion(manifest, target);
		expect(next.images).toEqual({ hero: "/assets/hero.png" });
		expect(next.atlases.characters).toEqual({
			image: "/assets/hero.png",
			regions: { "hero.down": { x: 0, y: 0, w: 16, h: 32 } },
		});
	});

	test("adds a region to an existing atlas without dropping its other regions", () => {
		let manifest: ManifestAtlases = {
			images: {},
			atlases: {
				characters: {
					image: "/assets/hero.png",
					regions: { "hero.up": { x: 0, y: 32, w: 16, h: 32 } },
				},
			},
		};
		let next = registerAtlasRegion(manifest, target);
		expect(Object.keys(next.atlases.characters!.regions).sort()).toEqual(["hero.down", "hero.up"]);
	});

	test("carries through other manifest kinds and unrelated atlas fields", () => {
		let manifest: ManifestAtlases = {
			images: { other: "/assets/other.png" },
			audio: { theme: { url: "/audio/theme.ogg" } },
			atlases: {
				characters: {
					image: "/assets/hero.png",
					regions: {},
					animations: { walk: { frames: [], frameMs: 100 } },
				},
			},
		};
		let next = registerAtlasRegion(manifest, target);
		expect(next.images.other).toBe("/assets/other.png");
		expect(next.audio).toEqual({ theme: { url: "/audio/theme.ogg" } });
		// The pre-existing `animations` field survives the region add.
		expect(next.atlases.characters!.animations).toEqual({ walk: { frames: [], frameMs: 100 } });
	});

	test("does not mutate the input manifest", () => {
		let manifest: ManifestAtlases = { images: {}, atlases: {} };
		registerAtlasRegion(manifest, target);
		expect(manifest.images).toEqual({});
		expect(manifest.atlases).toEqual({});
	});
});

describe("runAtlasExport", () => {
	test("rejects a malformed payload before writing", async () => {
		let result = await runAtlasExport({ name: "hero" });
		expect(isFailure(result)).toBe(true);
	});

	test("rejects an invalid atlas id before writing", async () => {
		let result = await runAtlasExport({
			name: "hero",
			pngBase64: ONE_PX_PNG_BASE64,
			atlasId: "Bad Atlas",
			region: "hero.down",
			x: 0,
			y: 0,
			w: 1,
			h: 1,
		});
		expect(isFailure(result)).toBe(true);
	});

	test("writes the PNG and registers the image + atlas region in the manifest", async () => {
		let SPRITE_NAME = "atlas-export-test-sprite";
		let SPRITE_ASSET_PATH = `src/assets/${SPRITE_NAME}.png`;
		let manifestFile = resolve(APP_ROOT, MANIFEST_PATH);
		let original = existsSync(manifestFile) ? await readFile(manifestFile, "utf8") : null;

		try {
			let result = await runAtlasExport({
				name: SPRITE_NAME,
				pngBase64: ONE_PX_PNG_BASE64,
				atlasId: "test-atlas",
				region: "sprite.one",
				x: 0,
				y: 0,
				w: 1,
				h: 1,
			});
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.id).toBe(SPRITE_NAME);
				expect(result.data.path).toBe(SPRITE_ASSET_PATH);
				expect(result.data.url).toBe(`/assets/${SPRITE_NAME}.png`);
				expect(result.data.atlasId).toBe("test-atlas");
				expect(result.data.region).toBe("sprite.one");
				expect(result.data.rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
				expect(result.data.bytesWritten).toBeGreaterThan(0);

				// The PNG landed on disk with the expected magic bytes.
				let pngBytes = new Uint8Array(await readFile(resolve(APP_ROOT, SPRITE_ASSET_PATH)));
				expect(Array.from(pngBytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

				// The manifest now holds both the flat image and the atlas region.
				let manifestText = await readFile(resolve(APP_ROOT, MANIFEST_PATH), "utf8");
				let manifest = JSON.parse(manifestText) as ManifestAtlases;
				expect(manifest.images[SPRITE_NAME]).toBe(`/assets/${SPRITE_NAME}.png`);
				expect(manifest.atlases["test-atlas"]).toEqual({
					image: `/assets/${SPRITE_NAME}.png`,
					regions: { "sprite.one": { x: 0, y: 0, w: 1, h: 1 } },
				});
			}
		} finally {
			// Restore the manifest and delete the scratch PNG — leave no trace.
			if (original !== null) await writeFile(resolve(APP_ROOT, MANIFEST_PATH), original);
			await rm(resolve(APP_ROOT, SPRITE_ASSET_PATH), { force: true });
		}
	});
});
