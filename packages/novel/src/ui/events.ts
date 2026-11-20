/**
 * The DOM events of a player: a save, a settings change and an ending from its root, which an
 * app listens to with `on()` and stores, and an interaction's completion, which an app's
 * component dispatches for `NovelPlayer.Interaction` to answer the frame with. They all bubble.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InteractionDeclaration } from "../declarations.js";
import type { Ending, GameState } from "../frames.js";
import type { SchemaInput } from "../types.js";

import type { NovelSettings } from "./settings.js";

declare global {
	interface HTMLElementEventMap {
		"novel:save": NovelSaveEvent;
		"novel:settings": NovelSettingsEvent;
		"novel:ending": NovelEndingEvent;
		"novel:complete": InteractionCompleteEvent;
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

/**
 * Dispatched as `novel:complete` by an interaction's component when it is done, with the output
 * typed by the declaration's output schema. `NovelPlayer.Interaction` answers the current frame
 * with it when the frame is that interaction; the engine validates the output.
 *
 * @template Declaration - The interaction it completes.
 * @example root.dispatchEvent(new InteractionCompleteEvent(INTERACTIONS.fishing, { caught: 3 }))
 */
export class InteractionCompleteEvent<
	Declaration extends InteractionDeclaration = InteractionDeclaration,
> extends Event {
	/** The name of the interaction it completes, which a custom frame carries. */
	readonly interaction: Declaration["name"];
	readonly output: SchemaInput<Declaration["output"]>;

	/**
	 * @param declaration - The interaction, from the app's `interactions()` map.
	 * @param output - What it hands back to the scene.
	 */
	constructor(declaration: Declaration, output: SchemaInput<Declaration["output"]>) {
		super("novel:complete", { bubbles: true });
		this.interaction = declaration.name;
		this.output = output;
	}
}
