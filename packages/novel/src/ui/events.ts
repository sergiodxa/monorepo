/**
 * The DOM events `NovelPlayer` dispatches from its root element: a save, a settings change and
 * an ending. They bubble, so an app listens with `on()` on the player or any ancestor and stores
 * what they carry, which keeps storage the app's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Ending, GameState } from "../frames.js";

import type { NovelSettings } from "./settings.js";

declare global {
	interface HTMLElementEventMap {
		"novel:save": NovelSaveEvent;
		"novel:settings": NovelSettingsEvent;
		"novel:ending": NovelEndingEvent;
	}
}

/**
 * Dispatched as `novel:save` when the reader saves, with the slot and the play as JSON for the
 * app to store; the save also reaches the novel's `save` event.
 *
 * @example on("novel:save", (event) => store(event.slot, event.state))
 */
export class NovelSaveEvent extends Event {
	readonly slot: string;
	readonly state: GameState;

	/**
	 * @param slot - The slot the reader saved into.
	 * @param state - The play as JSON.
	 */
	constructor(slot: string, state: GameState) {
		super("novel:save", { bubbles: true });
		this.slot = slot;
		this.state = state;
	}
}

/**
 * Dispatched as `novel:settings` whenever the reader changes a setting, with the whole settings
 * object, so the app stores one JSON value and passes it back through `settings`.
 *
 * @example on("novel:settings", (event) => store(event.settings))
 */
export class NovelSettingsEvent extends Event {
	readonly settings: NovelSettings;

	/** @param settings - Every setting, as the reader left them. */
	constructor(settings: NovelSettings) {
		super("novel:settings", { bubbles: true });
		this.settings = settings;
	}
}

/**
 * Dispatched as `novel:ending` when the play reaches an ending or runs out of story, which a
 * replay with no play to resume also does.
 *
 * @example on("novel:ending", (event) => showCredits(event.ending.key))
 */
export class NovelEndingEvent extends Event {
	readonly ending: Ending;

	/** @param ending - The ending's key (`null` when the story ran out) and its scene. */
	constructor(ending: Ending) {
		super("novel:ending", { bubbles: true });
		this.ending = ending;
	}
}
