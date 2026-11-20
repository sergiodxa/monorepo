/**
 * A timed menu's countdown as a headless model: it starts when a timed menu shows, restarts for
 * a new menu, and dispatches `expire` with the option the menu takes when time runs out: its
 * default, else its first available option.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

import type { ChoiceFrame } from "../../frames.js";

/**
 * The option a timed menu takes when it runs out: its `default`, else its first available option.
 *
 * @param frame - The menu.
 * @returns The option's id, or `undefined` when nothing is available.
 */
export function timeoutOption(frame: ChoiceFrame): string | undefined {
	return frame.default ?? frame.options.find((option) => !option.disabled)?.id;
}

/** Dispatched by {@link CountdownModel} when a timed menu runs out. */
export class CountdownExpireEvent extends Event {
	/** The menu that ran out. */
	readonly frame: ChoiceFrame;
	/** The option it takes. */
	readonly option: string;

	constructor(frame: ChoiceFrame, option: string) {
		super("expire");
		this.frame = frame;
		this.option = option;
	}
}

/**
 * What the player and the menu need from a timed menu's countdown, which `NovelPlayer`'s
 * `behaviors.countdown` replaces: the menu starts it, an answer cancels it, and its `expire`
 * answers the menu with the option it carries.
 */
export interface CountdownBehavior extends TypedEventTarget<CountdownBehavior.EventMap> {
	/** Starts `frame`'s countdown as the menu shows, which a menu without `timeout` ignores. */
	start(frame: ChoiceFrame): void;
	/** Stops the running countdown, as answering the menu does. */
	cancel(): void;
}

export namespace CountdownBehavior {
	/** Events a {@link CountdownBehavior} dispatches. */
	export interface EventMap {
		/** Dispatched after a countdown starts or stops. */
		change: Event;
		/** Answers the menu it carries, when that menu is still the current frame. */
		expire: CountdownExpireEvent;
	}
}

export namespace CountdownModel {
	/** Events {@link CountdownModel} dispatches. */
	export interface EventMap extends CountdownBehavior.EventMap {}
}

/**
 * Counts one timed menu down at a time; a menu without `timeout` counts nothing.
 *
 * @example countdown.addEventListener("expire", (event) => player.answer(event.frame.choose(event.option)));
 */
export class CountdownModel
	extends TypedEventTarget<CountdownModel.EventMap>
	implements CountdownBehavior
{
	#frame: ChoiceFrame | undefined;
	#endsAt: number | undefined;
	#timer: ReturnType<typeof setTimeout> | undefined;

	/** The menu counting down, or `undefined`. */
	get frame(): ChoiceFrame | undefined {
		return this.#frame;
	}

	/** When the countdown ends, as a `Date.now()` time, or `undefined`. */
	get endsAt(): number | undefined {
		return this.#endsAt;
	}

	/** Starts `frame`'s countdown, unless that menu already counts down. */
	start(frame: ChoiceFrame): void {
		if (this.#frame?.id === frame.id) return;
		this.cancel();
		let timeout = frame.timeout;
		if (timeout === undefined) return;
		this.#frame = frame;
		this.#endsAt = Date.now() + timeout;
		this.#timer = setTimeout(() => {
			if (this.#frame !== frame) return;
			let option = timeoutOption(frame);
			this.#frame = undefined;
			this.#endsAt = undefined;
			dispatchChange(this);
			if (option !== undefined) this.dispatchEvent(new CountdownExpireEvent(frame, option));
		}, timeout);
		dispatchChange(this);
	}

	/** Stops the running countdown, as answering the menu does. */
	cancel(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
		if (this.#frame === undefined) return;
		this.#frame = undefined;
		this.#endsAt = undefined;
		dispatchChange(this);
	}
}
