/**
 * Tests for the asset store's map loading, validation, and atlas slicing helpers.
 *
 * Focuses on the map path, which is the reliable end-to-end route under the Bun
 * HTML dev server: a manifest map source given as an inline object is validated
 * through the loader and registered (available via `map(id)`), while a malformed
 * inline map is skipped so a bad map never registers a broken value that would
 * crash the renderer. Uses inline map objects so no network or DOM is needed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { createSampleMap } from "../overworld/map-loader";

import { AssetStore, type AssetManifest, expandAtlasRegions } from "./assets";

/** A manifest with no images/audio/atlases and the given inline maps. */
function manifestWithMaps(maps: AssetManifest["maps"]): AssetManifest {
	return { images: {}, audio: {}, maps, atlases: {} };
}

test("an inline map object is validated and registered under its id", async () => {
	let store = new AssetStore(manifestWithMaps({ "route-1": createSampleMap() }));
	await store.loadAll(() => {});
	let map = store.map("route-1");
	expect(map).not.toBeNull();
	expect(map?.id).toBe("route-1");
});

test("a malformed inline map is skipped, leaving its id unregistered", async () => {
	let store = new AssetStore(manifestWithMaps({ broken: { id: "broken" } }));
	await store.loadAll(() => {});
	expect(store.map("broken")).toBeNull();
});

test("map(id) returns null for an id the manifest never declared", async () => {
	let store = new AssetStore(manifestWithMaps({}));
	await store.loadAll(() => {});
	expect(store.map("missing")).toBeNull();
});

test("expandAtlasRegions merges explicit regions with row-major grid slices", () => {
	let regions = expandAtlasRegions({
		image: "/assets/sheet.png",
		regions: {
			full: { x: 0, y: 0, w: 40, h: 20 },
			"sprite.6": { x: 20, y: 20, w: 4, h: 4 },
		},
		slices: [
			{
				prefix: "sprite",
				x: 1,
				y: 2,
				w: 8,
				h: 8,
				columns: 2,
				rows: 2,
				spacingX: 1,
				spacingY: 2,
				start: 5,
			},
		],
	});

	expect(regions.full).toEqual({ x: 0, y: 0, w: 40, h: 20 });
	expect(regions["sprite.5"]).toEqual({ x: 1, y: 2, w: 8, h: 8 });
	expect(regions["sprite.6"]).toEqual({ x: 20, y: 20, w: 4, h: 4 });
	expect(regions["sprite.7"]).toEqual({ x: 1, y: 12, w: 8, h: 8 });
	expect(regions["sprite.8"]).toEqual({ x: 10, y: 12, w: 8, h: 8 });
});
