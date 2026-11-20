/**
 * The typewriter's reveal as a headless model: which line is shown, whether it is waiting for
 * the stage, typing or fully revealed, whether the reader asked for the rest at once, and the
 * speed to type at. Whatever paints the text drives it, so a custom textbox can replace ours.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

/** Where a line is in its reveal. */
export type RevealStatus = "idle" | "waiting" | "typing" | "revealed";

/**
 * What the player and its line need from a line's reveal, which `NovelPlayer`'s
 * `behaviors.reveal` replaces: the player moves it through `begin`, `start` and `clear`, and
 * whatever paints the text types while `status` is `"typing"` and reports `reveal()`.
 */
export interface RevealBehavior extends TypedEventTarget<RevealBehavior.EventMap> {
	/** The id of the line frame being revealed, or `undefined` between lines. */
	readonly line: string | undefined;
	readonly status: RevealStatus;
	/** True once the rest of the line should show at once: a click, skip or a restored frame. */
	readonly complete: boolean;
	/** Characters per second; the player sets the reader's text speed as each line starts. */
	speed: number;
	/** Takes a new line, waiting for `start()`; `complete` shows it whole once it starts. */
	begin(line: string, complete?: boolean): void;
	/** Starts typing the line, once the stage has settled. */
	start(): void;
	/** Asks for the rest of the line at once. */
	finish(): void;
	/** Reports the whole line visible; its `change` to `"revealed"` lets the play wait. */
	reveal(): void;
	/** Leaves the line, as a menu, a pause or the end of the play does. */
	clear(): void;
}

export namespace RevealBehavior {
	/** Events a {@link RevealBehavior} dispatches. */
	export interface EventMap {
		/** Dispatched after the line, its status, `complete` or the speed changes. */
		change: Event;
	}
}

export namespace RevealModel {
	/** Events {@link RevealModel} dispatches. */
	export interface EventMap extends RevealBehavior.EventMap {}
}

/**
 * Tracks one line's reveal. The player calls `begin()` as a line takes the stage and `start()`
 * once the stage settles; the textbox types while `status` is `"typing"`, shows everything when
 * `complete` is true, and calls `reveal()` once the whole line is visible.
 *
 * @example reveal.addEventListener("change", () => { if (reveal.status === "typing") reveal.reveal(); });
 */
export class RevealModel extends TypedEventTarget<RevealModel.EventMap> implements RevealBehavior {
	#line: string | undefined;
	#status: RevealStatus = "idle";
	#complete = false;
	#speed: number;

	/** @param speed - Characters per second; `0` shows a line at once. */
	constructor(speed = 40) {
		super();
		this.#speed = speed;
	}

	/** The id of the line frame being revealed, or `undefined` between lines. */
	get line(): string | undefined {
		return this.#line;
	}

	get status(): RevealStatus {
		return this.#status;
	}

	/** True once the rest of the line should show at once: a click, skip or a restored frame. */
	get complete(): boolean {
		return this.#complete;
	}

	/** Characters per second, the reader's text speed; `0` shows a line at once. */
	get speed(): number {
		return this.#speed;
	}

	set speed(value: number) {
		if (value === this.#speed) return;
		this.#speed = value;
		dispatchChange(this);
	}

	/** Takes a new line, waiting for `start()`; `complete` shows it whole once it starts. */
	begin(line: string, complete = false): void {
		this.#line = line;
		this.#status = "waiting";
		this.#complete = complete;
		dispatchChange(this);
	}

	/** Starts typing the line, once the stage has settled. */
	start(): void {
		if (this.#status !== "waiting") return;
		this.#status = "typing";
		dispatchChange(this);
	}

	/** Asks for the rest of the line at once. */
	finish(): void {
		if (this.#complete || this.#status === "revealed" || this.#status === "idle") return;
		this.#complete = true;
		dispatchChange(this);
	}

	/** Reports that the whole line is visible, which lets the play wait for the reader. */
	reveal(): void {
		if (this.#status !== "typing") return;
		this.#status = "revealed";
		this.#complete = true;
		dispatchChange(this);
	}

	/** Leaves the line, as a menu, a pause or the end of the play does. */
	clear(): void {
		if (this.#status === "idle") return;
		this.#line = undefined;
		this.#status = "idle";
		this.#complete = false;
		dispatchChange(this);
	}
}
