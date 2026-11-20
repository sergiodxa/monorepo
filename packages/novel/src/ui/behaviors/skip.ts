/**
 * Skip as a headless model: toggled from a menu or key, or held like Control, and the rule for
 * what it passes through: every line, or only lines already read, stopping at the first unread
 * one, at a menu and at an interaction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

import type { StopFrame } from "../../frames.js";
import type { SkipMode } from "../settings.js";

/** Milliseconds skip mode shows each line for. */
export const SKIP_STEP_MS = 40;

/**
 * What the player needs from skip, which `NovelPlayer`'s `behaviors.skip` replaces: whether it is
 * on, toggling and holding it, stopping it where it must not pass, and the rule for what it passes.
 */
export interface SkipBehavior extends TypedEventTarget<SkipBehavior.EventMap> {
	/** True while skip is on; the player hurries every frame while it is. */
	readonly active: boolean;
	toggle(): void;
	/** Skips for as long as `held` stays true, the way held Control does. */
	hold(held: boolean): void;
	/** Switches toggled skip off; the player calls it at a menu, an interaction or an unread line. */
	stop(): void;
	/** Whether skip goes past `frame` under the reader's skip setting. */
	passes(frame: StopFrame, mode: SkipMode): boolean;
}

export namespace SkipBehavior {
	/** Events a {@link SkipBehavior} dispatches. */
	export interface EventMap {
		/** Dispatched after skip starts or stops. */
		change: Event;
	}
}

export namespace SkipModel {
	/** Events {@link SkipModel} dispatches. */
	export interface EventMap extends SkipBehavior.EventMap {}
}

/**
 * Holds whether skip is on. Toggled skip stops itself where {@link SkipModel.passes} says no;
 * held skip lasts while it is held.
 *
 * @example if (skip.active && !skip.passes(frame, settings.skip)) skip.stop();
 */
export class SkipModel extends TypedEventTarget<SkipModel.EventMap> implements SkipBehavior {
	#toggled = false;
	#held = false;

	/** True while skip is on, toggled or held. */
	get active(): boolean {
		return this.#toggled || this.#held;
	}

	/** True while skip is switched on from a menu or key. */
	get toggled(): boolean {
		return this.#toggled;
	}

	/** True while skip is held down. */
	get held(): boolean {
		return this.#held;
	}

	toggle(): void {
		this.#toggled = !this.#toggled;
		dispatchChange(this);
	}

	/** Skips for as long as `held` stays true. */
	hold(held: boolean): void {
		if (held === this.#held) return;
		this.#held = held;
		dispatchChange(this);
	}

	/** Switches toggled skip off; held skip goes on until it is released. */
	stop(): void {
		if (!this.#toggled) return;
		this.#toggled = false;
		dispatchChange(this);
	}

	/**
	 * Whether skip goes past `frame`: a line read before, or any line in `"all"` mode, and a
	 * pause. A menu and an interaction wait for the reader.
	 */
	passes(frame: StopFrame, mode: SkipMode): boolean {
		if (frame.type === "pause") return true;
		if (frame.type !== "line") return false;
		return mode === "all" || frame.seen;
	}
}
