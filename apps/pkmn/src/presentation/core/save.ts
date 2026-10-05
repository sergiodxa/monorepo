/**
 * Save-file persistence for a single local slot.
 *
 * Pairs the engine's world snapshot with the presentation's own state (map
 * position, flags, options) and where every random stream stands, and normalises
 * older payloads via `migrateWorld`. Saving is offered only outside battle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Engine } from "~/game/engine";
import type { World } from "~/game/world/world";

import { migrateWorld } from "~/game/world/migrate";

import type { Direction } from "./direction";
import type { SessionRandom, SessionRandomState } from "./session-random";

import { openSessionRandom, readSessionRandom, snapshotSessionRandom } from "./session-random";

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
	/** Where the session's streams stood; a save written before streams were stored has none. */
	random?: SessionRandomState;
}

/** A loaded save: the world in its runtime shape and the session streams ready to draw. */
export interface LoadedSave extends Omit<SaveFile, "world" | "random"> {
	world: World;
	random: SessionRandom;
}

/** Reads and writes one save slot in `localStorage`. */
export class SaveStore {
	/** @param key - The `localStorage` key backing this slot. */
	constructor(private readonly key: string) {}

	/** True when the slot parses, regardless of its save-version. */
	has(): boolean {
		return this.read() !== null;
	}

	/**
	 * Writes a save envelope, stamping the timestamp the caller passes and
	 * recording where every random stream stands, so a loaded game draws what
	 * this one would have drawn next.
	 */
	save(
		world: PersistentWorld,
		presentation: PresentationSave,
		savedAt: string,
		random: SessionRandom,
	) {
		let file: SaveFile = {
			version: 1,
			savedAt,
			world,
			presentation,
			random: snapshotSessionRandom(random),
		};
		globalThis.localStorage.setItem(this.key, JSON.stringify(file));
	}

	/**
	 * Loads and normalises the save, or returns null when the slot is empty or unreadable.
	 *
	 * The returned `world` is migrated to the full runtime `World` shape and
	 * `random` resumes the stored streams, both ready for `Engine.create`. A save
	 * without stored streams opens fresh ones; a malformed stream state is unreadable.
	 */
	load(): LoadedSave | null {
		let file = this.read();
		if (!file || file.version !== 1) return null;
		let { random, ...rest } = file;
		if (random === undefined) {
			return { ...rest, world: migrateWorld(file.world), random: openSessionRandom() };
		}
		let restored = readSessionRandom(random);
		if (restored === null) return null;
		return { ...rest, world: migrateWorld(file.world), random: restored };
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
