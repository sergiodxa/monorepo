/**
 * `LocalStorageStore`: keeps what a web novel must survive a reload (saves, settings and the
 * persistent record of lines read, endings and unlocks) in the browser's `localStorage`, hands
 * it back to a player on load, and writes it back as the player plays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createMixin } from "remix/component";

import type { GameState } from "../frames.js";
import type { StartOptions } from "../novel.js";
import type { NovelSettings, StoredSettings } from "../ui/settings.js";

import { NovelPlayer } from "../ui/player.js";
import { listenerSignal } from "../ui/signal.js";

export namespace LocalStorageStore {
	/** Options {@link LocalStorageStore} accepts. */
	export interface Options {
		/**
		 * What every key starts with, as `<prefix>:saves`, `<prefix>:settings` and
		 * `<prefix>:persistent`, so two novels on one origin keep separate data.
		 *
		 * @default "novel"
		 */
		prefix?: string;
	}

	/** What a store read back, shaped as the player's props so it spreads onto one. */
	export interface Stored {
		/** Every readable save by slot; empty when none is stored. */
		saves: Record<string, GameState>;
		/** The reader's settings, or `undefined` for the defaults. */
		settings: StoredSettings | undefined;
		/** The play's start, carrying the persistent record earlier playthroughs left. */
		start: StartOptions;
	}
}

/**
 * Stores a novel's saves, settings and persistent record in `localStorage`. Every access is
 * guarded, so a private window, a full quota or blocked site data reads as nothing stored and
 * writes report `false` while the novel keeps playing. Read it in the browser, where the player
 * runs, since a server render has no storage and reads nothing.
 *
 * @example let storage = new LocalStorageStore({ prefix: "cafe" });
 * @example <NovelPlayer.Default novel={novel} {...storage.read()} mix={storage.sync()} />
 */
export class LocalStorageStore {
	readonly #keys: { saves: string; settings: string; persistent: string };

	/** @param options - The key prefix. */
	constructor(options: LocalStorageStore.Options = {}) {
		let prefix = options.prefix ?? "novel";
		this.#keys = {
			saves: `${prefix}:saves`,
			settings: `${prefix}:settings`,
			persistent: `${prefix}:persistent`,
		};
	}

	/**
	 * Reads what is stored. A save that is not a save-shaped object is left out, and a value that
	 * is not JSON reads as missing; the player validates each save and the record it starts from.
	 *
	 * @returns The saves, settings and start, ready to spread onto `NovelPlayer`.
	 */
	read(): LocalStorageStore.Stored {
		let saves = this.#get(this.#keys.saves);
		let settings = this.#get(this.#keys.settings);
		return {
			saves: isObject(saves)
				? (Object.fromEntries(Object.entries(saves).filter(([, save]) => isSave(save))) as Record<
						string,
						GameState
					>)
				: {},
			settings: isObject(settings) ? (settings as StoredSettings) : undefined,
			start: { persistent: this.#get(this.#keys.persistent) },
		};
	}

	/**
	 * Stores a save beside the ones already stored, replacing the one in its slot.
	 *
	 * @returns Whether storage kept it.
	 */
	putSave(slot: string, state: GameState): boolean {
		return this.#set(this.#keys.saves, { ...this.read().saves, [slot]: state });
	}

	/**
	 * Stores the reader's settings.
	 *
	 * @returns Whether storage kept them.
	 */
	putSettings(settings: NovelSettings | StoredSettings): boolean {
		return this.#set(this.#keys.settings, settings);
	}

	/**
	 * Stores the persistent record a novel's `persist` event carries.
	 *
	 * @returns Whether storage kept it.
	 */
	putPersistent(persistent: unknown): boolean {
		return this.#set(this.#keys.persistent, persistent);
	}

	/**
	 * Removes the saves, settings and persistent record, so the next read is a first playthrough.
	 *
	 * @returns Whether storage removed them.
	 */
	clear(): boolean {
		try {
			for (let key of Object.values(this.#keys)) localStorage.removeItem(key);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * A mixin for `NovelPlayer` that stores each `novel:save` and `novel:settings` it dispatches
	 * and every `persist` of its novel, until the player leaves the page.
	 *
	 * @example <NovelPlayer.Default novel={novel} {...storage.read()} mix={storage.sync()} />
	 */
	sync() {
		return syncStore(this);
	}

	/** A stored JSON value, or `undefined` when it is missing, not JSON, or storage is unavailable. */
	#get(key: string): unknown {
		try {
			let text = localStorage.getItem(key);
			return text === null ? undefined : (JSON.parse(text) as unknown);
		} catch {
			return undefined;
		}
	}

	/** Stores a JSON value and reports whether storage kept it. */
	#set(key: string, value: unknown): boolean {
		try {
			localStorage.setItem(key, JSON.stringify(value));
			return true;
		} catch {
			return false;
		}
	}
}

/** True for a plain JSON object. */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True for a value shaped enough like a save for a title screen to read its `meta`. */
function isSave(value: unknown): boolean {
	return isObject(value) && isObject(value["meta"]) && typeof value["meta"]["savedAt"] === "string";
}

/**
 * Writes a player's saves and settings from its DOM events, and its novel's persistent record
 * from `persist`, into the store the player's `sync()` named.
 */
const syncStore = createMixin<HTMLElement, [store: LocalStorageStore]>(
	(handle) => {
		let store: LocalStorageStore | undefined;
		let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;

		handle.addEventListener("insert", (event) => {
			let signal = listenerSignal(handle);
			event.node.addEventListener("novel:save", (save) => store?.putSave(save.slot, save.state), {
				signal,
			});
			event.node.addEventListener(
				"novel:settings",
				(change) => store?.putSettings(change.settings),
				{ signal },
			);
			let stop = player?.novel.on("persist", (persistent) => store?.putPersistent(persistent));
			if (stop !== undefined) handle.signal.addEventListener("abort", stop);
		});

		return (next) => {
			store = next;
			return handle.element;
		};
	},
	{ ssr: false },
);
