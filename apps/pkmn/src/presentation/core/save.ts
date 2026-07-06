/**
 * Save-file persistence for a single local slot.
 *
 * A save envelope pairs the engine's persistent world snapshot with the
 * presentation's own state (map position, script flags, options) — the two
 * halves the engine deliberately keeps separate. `SaveStore` wraps
 * `localStorage`, validates the version on load, and normalises the world
 * through `migrateWorld` so an older payload upgrades to the current shape.
 * Saving is only offered outside battle, because battles are ephemeral.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Engine } from "~/game/engine";

import { migrateWorld } from "~/game/world/migrate";

import type { Direction } from "./direction";

/** The persistent world shape produced by `Engine.snapshot()`. */
export type PersistentWorld = ReturnType<Engine["snapshot"]>;

/** The presentation-owned half of a save: where the player is and how the game is configured. */
export interface PresentationSave {
	mapId: string;
	x: number;
	y: number;
	facing: Direction;
	flags: Record<string, boolean>;
	variables: Record<string, number>;
	options: { textSpeed: 1 | 2 | 3; volume: { bgm: number; sfx: number; cries: number } };
}

/** The full on-disk save envelope. */
export interface SaveFile {
	version: 1;
	savedAt: string;
	world: PersistentWorld;
	presentation: PresentationSave;
}

/** Reads and writes one save slot in `localStorage`. */
export class SaveStore {
	/** @param key - The `localStorage` key backing this slot. */
	constructor(private readonly key: string) {}

	/** True when a save exists in this slot. */
	has(): boolean {
		return this.read() !== null;
	}

	/** Writes a save envelope, stamping the timestamp the caller passes. */
	save(world: PersistentWorld, presentation: PresentationSave, savedAt: string) {
		let file: SaveFile = { version: 1, savedAt, world, presentation };
		globalThis.localStorage.setItem(this.key, JSON.stringify(file));
	}

	/** Loads and normalises the save, or returns null when the slot is empty or unreadable. */
	load(): SaveFile | null {
		let file = this.read();
		if (!file || file.version !== 1) return null;
		return { ...file, world: migrateWorld(file.world) as PersistentWorld };
	}

	/** Deletes the save in this slot. */
	clear() {
		globalThis.localStorage.removeItem(this.key);
	}

	/** Parses the raw slot contents, returning null on any read/parse failure. */
	private read(): SaveFile | null {
		let raw = globalThis.localStorage.getItem(this.key);
		if (raw === null) return null;
		try {
			return JSON.parse(raw) as SaveFile;
		} catch {
			return null;
		}
	}
}
