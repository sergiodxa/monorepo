/**
 * Tests for the asset store's map loading and validation.
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
import { expect, test } from "bun:test";

import { createSampleMap } from "../overworld/map-loader";

import { AssetStore, type AssetManifest } from "./assets";

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
