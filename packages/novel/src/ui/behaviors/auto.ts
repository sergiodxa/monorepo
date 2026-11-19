/**
 * Auto mode as a headless model: on or off, and the wait before a shown line advances on its
 * own, which starts after the voice and self-voicing end and lasts the reader's delay plus a
 * share per character for an unvoiced line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

/** Milliseconds auto mode adds per character of an unvoiced line. */
export const AUTO_PER_CHARACTER_MS = 25;

export namespace AutoModel {
	/** Events {@link AutoModel} dispatches. */
	export interface EventMap {
		/** Dispatched after auto mode turns on or off. */
		change: Event;
	}

	/** What one wait needs to know about the line it waits on. */
	export interface Line {
		/** Characters shown, which an unvoiced line waits longer for. */
		length: number;
		voiced: boolean;
		/** The reader's `autoDelay`, in milliseconds. */
		delay: number;
		/** What must end first: the voice, self-voicing. */
		after?: ReadonlyArray<Promise<unknown>>;
	}
}

/**
 * Holds auto mode and the one wait it runs at a time; turning it off or starting another wait
 * cancels the pending one.
 *
 * @example auto.wait({ length: 24, voiced: false, delay: 1000 }, () => play.advance());
 */
export class AutoModel extends TypedEventTarget<AutoModel.EventMap> {
	#enabled = false;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#token = 0;

	get enabled(): boolean {
		return this.#enabled;
	}

	/**
	 * How long a line stays once its voice and self-voicing end.
	 *
	 * @example AutoModel.delayFor({ length: 10, voiced: false, delay: 1000 }); // 1250
	 */
	static delayFor(line: Pick<AutoModel.Line, "length" | "voiced" | "delay">): number {
		return line.delay + (line.voiced ? 0 : line.length * AUTO_PER_CHARACTER_MS);
	}

	/** Turns auto mode on or off, cancelling the pending wait when it goes off. */
	set(enabled: boolean): void {
		if (enabled === this.#enabled) return;
		this.#enabled = enabled;
		if (!enabled) this.cancel();
		dispatchChange(this);
	}

	toggle(): void {
		this.set(!this.#enabled);
	}

	/** Calls `advance` once `line` has waited its turn, unless auto mode goes off first. */
	wait(line: AutoModel.Line, advance: () => void): void {
		this.cancel();
		if (!this.#enabled) return;
		let token = this.#token;
		void Promise.all(line.after ?? []).then(() => {
			if (token !== this.#token || !this.#enabled) return;
			this.#timer = setTimeout(() => {
				if (token === this.#token && this.#enabled) advance();
			}, AutoModel.delayFor(line));
		});
	}

	/** Drops the pending wait. */
	cancel(): void {
		this.#token++;
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}
}
