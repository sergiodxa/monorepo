/**
 * Autosave as a headless model: it asks the player to save into the autosave slot when a chapter
 * starts and every few lines, so a reader who closes the tab loses little. The player performs
 * the save, so an autosave leaves as `novel:save` and shows on the save screens like any other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/component";

/** The slot autosaves write; the save screens list it as load-only. */
export const AUTO_SLOT = "auto";

/** Lines between two autosaves by default. */
const AUTOSAVE_EVERY = 20;

/**
 * What the player needs from autosave, which `NovelPlayer`'s `behaviors.autosave` replaces: the
 * slot it writes, and the play's progress to decide when. It dispatches `save` to ask for one;
 * the player saves at the stop the play shows, and never during a replay.
 */
export interface AutosaveBehavior extends TypedEventTarget<AutosaveBehavior.EventMap> {
	/** The slot every autosave writes. */
	readonly slot: string;
	/** Called as the play enters a chapter, a new play's first one included. */
	chapter(): void;
	/** Called as each line takes the stage. */
	line(): void;
	/** Called when the reader leaves the page, such as by switching tabs; it may ask for a save. */
	leave?(): void;
}

export namespace AutosaveBehavior {
	/** Events an {@link AutosaveBehavior} dispatches. */
	export interface EventMap {
		/** Asks the player to save the play into `slot` now. */
		save: Event;
	}
}

export namespace AutosaveModel {
	/** Events {@link AutosaveModel} dispatches. */
	export interface EventMap extends AutosaveBehavior.EventMap {}

	/** Options {@link AutosaveModel} takes. */
	export interface Options {
		/**
		 * Lines between two autosaves; a chapter's start saves and starts the count over.
		 *
		 * @default 20
		 */
		every?: number;
		/**
		 * The slot autosaves write.
		 *
		 * @default AUTO_SLOT
		 */
		slot?: string;
	}
}

/**
 * Asks for a save when a chapter starts and after every `every` lines.
 *
 * @example new AutosaveModel({ every: 10 })
 */
export class AutosaveModel
	extends TypedEventTarget<AutosaveModel.EventMap>
	implements AutosaveBehavior
{
	readonly slot: string;
	readonly every: number;
	#lines = 0;

	/** @param options - How often to save, and where. */
	constructor(options: AutosaveModel.Options = {}) {
		super();
		this.slot = options.slot ?? AUTO_SLOT;
		this.every = Math.max(1, options.every ?? AUTOSAVE_EVERY);
	}

	/** Lines shown since the last autosave. */
	get pending(): number {
		return this.#lines;
	}

	/** Saves at the chapter's start and counts its lines from zero. */
	chapter(): void {
		this.#save();
	}

	/** Counts a line, saving once `every` lines have shown since the last save. */
	line(): void {
		this.#lines += 1;
		if (this.#lines >= this.every) this.#save();
	}

	/** Starts the count over and asks the player to save. */
	/** Saves when lines have shown since the last save, so the reader returns to the line they left. */
	leave(): void {
		if (this.#lines > 0) this.#save();
	}

	#save(): void {
		this.#lines = 0;
		this.dispatchEvent(new Event("save"));
	}
}
