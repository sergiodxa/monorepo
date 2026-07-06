/**
 * Tests for the local save-slot store.
 *
 * Covers the `SaveStore` round-trip through a Map-backed `localStorage` stub:
 * `save`/`load`/`has`/`clear`, and `load` returning null for a missing slot,
 * unparseable JSON, and a wrong-version envelope. The stored world is a minimal
 * fixture that survives `migrateWorld` — save internals, not world shape, are
 * under test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, expect, test } from "bun:test";

import type { PersistentWorld, PresentationSave } from "./save";

import { SaveStore } from "./save";

/** Installs a fresh Map-backed `localStorage` and returns its raw backing store. */
function installLocalStorage() {
	let store = new Map<string, string>();
	let stub = {
		getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
		key: (index: number) => [...store.keys()][index] ?? null,
		get length() {
			return store.size;
		},
	};
	(globalThis as { localStorage: unknown }).localStorage = stub;
	return store;
}

/** A minimal persistent world that migrates cleanly to the runtime shape. */
let WORLD = {
	entities: ["hero"],
	playerId: "hero",
	playerProfile: {},
	party: {},
	inventory: {},
	money: {},
	bestiary: {},
	storageBoxes: {},
} as unknown as PersistentWorld;

/** A minimal presentation-side save payload. */
let PRESENTATION: PresentationSave = {
	mapId: "route-1",
	x: 5,
	y: 5,
	facing: "down",
	flags: { metRival: true },
	variables: { steps: 42 },
	options: { textSpeed: 2, volume: { bgm: 0.8, sfx: 0.5, cries: 1 } },
};

let backing: Map<string, string>;

beforeEach(() => {
	backing = installLocalStorage();
});

afterEach(() => {
	backing.clear();
});

test("has is false and load is null for an empty slot", () => {
	let store = new SaveStore("slot-1");
	expect(store.has()).toBe(false);
	expect(store.load()).toBeNull();
});

test("save then load round-trips the presentation payload and metadata", () => {
	let store = new SaveStore("slot-1");
	store.save(WORLD, PRESENTATION, "2026-07-06T00:00:00.000Z");

	expect(store.has()).toBe(true);
	let loaded = store.load();
	expect(loaded).not.toBeNull();
	expect(loaded!.version).toBe(1);
	expect(loaded!.savedAt).toBe("2026-07-06T00:00:00.000Z");
	expect(loaded!.presentation).toEqual(PRESENTATION);
	// The world came back migrated with its entities intact.
	expect(loaded!.world.entities).toContain("hero");
	expect(loaded!.world.playerId).toBe("hero");
});

test("clear removes the saved slot", () => {
	let store = new SaveStore("slot-1");
	store.save(WORLD, PRESENTATION, "2026-07-06T00:00:00.000Z");
	expect(store.has()).toBe(true);
	store.clear();
	expect(store.has()).toBe(false);
	expect(store.load()).toBeNull();
});

test("load returns null for unparseable JSON in the slot", () => {
	backing.set("slot-1", "{ not valid json");
	let store = new SaveStore("slot-1");
	expect(store.load()).toBeNull();
	expect(store.has()).toBe(false);
});

test("load returns null for a wrong-version envelope", () => {
	backing.set(
		"slot-1",
		JSON.stringify({ version: 99, savedAt: "x", world: WORLD, presentation: PRESENTATION }),
	);
	let store = new SaveStore("slot-1");
	expect(store.load()).toBeNull();
	// `has` only checks the slot parses, so a stored-but-unloadable envelope still reads present.
	expect(store.has()).toBe(true);
});

test("each key backs an independent slot", () => {
	let one = new SaveStore("slot-1");
	let two = new SaveStore("slot-2");
	one.save(WORLD, PRESENTATION, "2026-07-06T00:00:00.000Z");
	expect(one.has()).toBe(true);
	expect(two.has()).toBe(false);
});
