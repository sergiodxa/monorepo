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

/**
 * What the player needs from auto mode, which `NovelPlayer`'s `behaviors.auto` replaces: whether
 * it is on, a toggle, and one wait at a time that owns how long a shown line stays. `AutoModel`
 * is the built-in one.
 *
 * @example <NovelPlayer novel={novel} behaviors={{ auto: new VoiceAwareAuto() }} />
 */
export interface AutoBehavior extends TypedEventTarget<AutoBehavior.EventMap> {
	/** True while auto mode is on; the quick menu shows it and the player waits only while it is. */
	readonly enabled: boolean;
	/** Turns auto mode on or off; it dispatches `change`, which makes the player wait or stop. */
	toggle(): void;
	/**
	 * Calls `advance` once `line` has stayed long enough, unless auto mode goes off or another
	 * wait starts first; the player calls it each time a line waits for the reader.
	 */
	wait(line: AutoBehavior.Line, advance: () => void): void;
	/** Drops the pending wait, as answering the frame or leaving it does. */
	cancel(): void;
}

export namespace AutoBehavior {
	/** Events an {@link AutoBehavior} dispatches. */
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

export namespace AutoModel {
	/** Events {@link AutoModel} dispatches. */
	export interface EventMap extends AutoBehavior.EventMap {}

	/** What one wait needs to know about the line it waits on. */
	export interface Line extends AutoBehavior.Line {}
}

/**
 * Holds auto mode and the one wait it runs at a time; turning it off or starting another wait
 * cancels the pending one. A subclass changes how long a line stays by overriding `delay()`.
 *
 * @example auto.wait({ length: 24, voiced: false, delay: 1000 }, () => play.advance());
 */
export class AutoModel extends TypedEventTarget<AutoModel.EventMap> implements AutoBehavior {
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

	/**
	 * How long `line` stays once what it waits `after` ends; {@link AutoModel.delayFor} unless a
	 * subclass says otherwise.
	 */
	delay(line: AutoModel.Line): number {
		return AutoModel.delayFor(line);
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
			}, this.delay(line));
		});
	}

	/** Drops the pending wait. */
	cancel(): void {
		this.#token++;
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}
}
