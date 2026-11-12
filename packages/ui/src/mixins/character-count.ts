/**
 * Why JS: a field's length changes with every keystroke and HTML has no live count, so
 * script redraws a `CharacterCount`'s ring and number as the field is typed in.
 * No-JS baseline: the count drawn for the field's server-rendered text, and the server's check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Where a field stands against its limit, which the count's `data-state` carries. */
export type CharacterCountState = "empty" | "ok" | "warn" | "over";

/** Types for {@link characterCount}. */
export namespace CharacterCountSync {
	/** Configuration for {@link characterCount}. */
	export interface Options {
		/** The `id` of the field counted. */
		for: string;
		max: number;
		/** How many characters left show the number. */
		warn: number;
		/** Disables the field's form's submit buttons while it is empty or over the limit. */
		holdSubmit: boolean;
		/** Announcements, with `{count}` replaced by the characters left or over. */
		labels: { remaining: string; over: string };
	}
}

/**
 * Counts what a reader sees as characters: grapheme clusters, so an emoji with skin tone or a
 * flag counts once. A server checking the same limit calls this, so the two never disagree.
 *
 * @param text The field's text.
 * @returns Its length in user-perceived characters.
 */
export function countCharacters(text: string): number {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text))
			.length;
	}
	return Array.from(text).length;
}

/**
 * Places a length against its limit.
 *
 * @param length The characters typed.
 * @param max The limit.
 * @param warn How many characters left start the warning.
 * @returns The state the count draws.
 */
export function characterCountState(
	length: number,
	max: number,
	warn: number,
): CharacterCountState {
	if (length === 0) return "empty";
	if (length > max) return "over";
	return max - length <= warn ? "warn" : "ok";
}

/** How far over the limit the ring gives way to the number alone, having nothing left to fill. */
const RING_GONE_OVER = 10;

/**
 * Whether a count is far enough over its limit to show the number alone.
 *
 * @param left Characters left; negative past the limit.
 * @returns `true` from ten over on.
 */
export function isRingHidden(left: number): boolean {
	return left <= -RING_GONE_OVER;
}

/**
 * Applied to a `CharacterCount`'s host: follows the field named by `for`, and on every
 * input sets the host's `data-state` and `--ui-character-count-progress`, writes the number
 * left into `[data-character-count-number]`, and announces a change of state only, so a screen
 * reader hears "20 characters left" once rather than at every key.
 *
 * @example <span mix={[characterCount({ for: "draft", max: 280, warn: 20, holdSubmit: true, labels })]} />
 */
export const characterCount: MixinFactory<HTMLElement, [options: CharacterCountSync.Options]> =
	createMixin<HTMLElement, [options: CharacterCountSync.Options]>((handle) => {
		let options: CharacterCountSync.Options | undefined;
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			let host = event.node;
			let signal = controller.signal;
			handle.queueTask(() => {
				if (!signal.aborted) connect(host, () => options, signal);
			});
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});

		return (next) => {
			options = next;
		};
	});

/**
 * Keeps `host` in step with its field until `signal` aborts.
 *
 * @param host The count's host element.
 * @param read Reads the latest options.
 * @param signal Ends the listener once the count leaves the document.
 */
function connect(
	host: HTMLElement,
	read: () => CharacterCountSync.Options | undefined,
	signal: AbortSignal,
): void {
	let options = read();
	if (!options) return;
	let field = host.ownerDocument.getElementById(options.for);
	if (!(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement)) return;
	let number = host.querySelector<HTMLElement>("[data-character-count-number]");
	let status = host.querySelector<HTMLElement>("[data-character-count-status]");
	let announced = host.dataset.state;

	/** Draws the field's current length onto the count, and holds or frees the submit. */
	let sync = () => {
		let current = read();
		if (!current || !field) return;
		let length = countCharacters(field.value);
		let left = current.max - length;
		let state = characterCountState(length, current.max, current.warn);
		host.dataset.state = state;
		host.toggleAttribute("data-ring-hidden", isRingHidden(left));
		host.style.setProperty(
			"--ui-character-count-progress",
			String(Math.min(1, length / current.max)),
		);
		if (number) number.textContent = state === "warn" || state === "over" ? String(left) : "";
		field.toggleAttribute("aria-invalid", state === "over");
		if (current.holdSubmit && field.form) {
			for (let button of field.form.querySelectorAll<HTMLButtonElement>(
				"button[type='submit'], button:not([type])",
			)) {
				button.disabled = state === "empty" || state === "over";
			}
		}
		if (status && state !== announced) {
			status.textContent = announcement(state, left, current.labels);
		}
		announced = state;
	};

	field.addEventListener("input", sync, { signal });
	field.form?.addEventListener("reset", () => queueMicrotask(sync), { signal });
	sync();
}

/**
 * The live region's copy for a state: silent while there is room, the characters left once
 * the warning starts, and how far over once past the limit.
 *
 * @param state Where the field stands.
 * @param left Characters left; negative past the limit.
 * @param labels The templates to fill.
 * @returns What the live region says.
 */
function announcement(
	state: CharacterCountState,
	left: number,
	labels: CharacterCountSync.Options["labels"],
): string {
	if (state === "warn") return labels.remaining.replace("{count}", String(left));
	if (state === "over") return labels.over.replace("{count}", String(-left));
	return "";
}
