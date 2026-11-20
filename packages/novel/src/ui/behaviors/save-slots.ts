/**
 * Save slots as a headless model: the quick slot plus numbered ones, what each holds, and a
 * `change` event when the reader saves, so the save and load screens show a new save at once
 * while storage stays the app's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

import type { GameState } from "../../frames.js";

/** The slot quick save writes and quick load reads. */
export const QUICK_SLOT = "quick";

/**
 * What the player and the save screens need from save slots, which `NovelPlayer`'s
 * `behaviors.saves` replaces: what a slot holds, a slot written as the reader saves, and the
 * saves the app stored adopted through the `saves` prop.
 */
export interface SavesBehavior extends TypedEventTarget<SavesBehavior.EventMap> {
	/** What `slot` holds, or `undefined` for an empty slot. */
	get(slot: string): GameState | undefined;
	/** Writes `state` into `slot` as the reader saves; its `change` redraws the save screens. */
	put(slot: string, state: GameState): void;
	/** Adopts the saves the app passes in the `saves` prop, without a `change`. */
	replace(stored: Readonly<Record<string, GameState>> | undefined): void;
}

export namespace SavesBehavior {
	/** Events a {@link SavesBehavior} dispatches. */
	export interface EventMap {
		/** Dispatched after a slot is written. */
		change: Event;
	}
}

export namespace SaveSlots {
	/** Events {@link SaveSlots} dispatches. */
	export interface EventMap extends SavesBehavior.EventMap {}
}

/**
 * Holds the saves of one player by slot name.
 *
 * @example let slots = new SaveSlots(stored); slots.put(QUICK_SLOT, play.save(QUICK_SLOT));
 */
export class SaveSlots extends TypedEventTarget<SaveSlots.EventMap> implements SavesBehavior {
	#saves: Record<string, GameState>;

	/** @param stored - The saves the app stored, by slot name. */
	constructor(stored?: Readonly<Record<string, GameState>>) {
		super();
		this.#saves = { ...stored };
	}

	/**
	 * The slot names a screen lists: the quick slot, then `count` numbered ones.
	 *
	 * @example SaveSlots.names(2); // ["quick", "1", "2"]
	 */
	static names(count: number): string[] {
		return [QUICK_SLOT, ...Array.from({ length: count }, (_, index) => String(index + 1))];
	}

	/** Every filled slot. */
	get all(): Readonly<Record<string, GameState>> {
		return this.#saves;
	}

	/** What `slot` holds, or `undefined` for an empty slot. */
	get(slot: string): GameState | undefined {
		return this.#saves[slot];
	}

	/** Writes `state` into `slot` and dispatches `change`. */
	put(slot: string, state: GameState): void {
		this.#saves = { ...this.#saves, [slot]: state };
		dispatchChange(this);
	}

	/** Adopts the saves the app stored, silently, since the app already has them. */
	replace(stored: Readonly<Record<string, GameState>> | undefined): void {
		this.#saves = { ...stored };
	}
}
