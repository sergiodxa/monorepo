/**
 * Edits a composer's text field the way typing would: the composer islands find the field
 * they act on and replace a range of its text through the browser's editing commands, so
 * each change lands on the native undo stack and fires the field's `input` event.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { COMPOSER_INPUT_SLOT } from "../composer.js";

/**
 * The text field an island acts on: the one whose `id` is `target`, or else the
 * `Composer.Input` of the form the island sits in.
 *
 * @param from An element of the island, which locates its form.
 * @param target The `id` of a `<textarea>` elsewhere on the page.
 * @returns The field, or `null` when neither names a `<textarea>`.
 */
export function findComposerInput(from: Element, target?: string): HTMLTextAreaElement | null {
	if (target !== undefined) {
		let named = from.ownerDocument.getElementById(target);
		return named instanceof HTMLTextAreaElement ? named : null;
	}
	return (
		from
			.closest("form")
			?.querySelector<HTMLTextAreaElement>(`[data-slot="${COMPOSER_INPUT_SLOT}"]`) ?? null
	);
}

/**
 * Replaces `start`–`end` of the field's text with `text` and leaves the caret after it. The
 * edit goes through `execCommand`, which Undo reverts; where the browser refuses it, the text
 * is set directly and an `input` event is dispatched so listeners hear the change either way.
 *
 * @param input The field to edit, which takes focus.
 * @param start Where the replaced range starts.
 * @param end Where it ends; equal to `start` for an insertion.
 * @param text What goes in its place.
 */
export function replaceText(
	input: HTMLTextAreaElement,
	start: number,
	end: number,
	text: string,
): void {
	let expected = input.value.slice(0, start) + text + input.value.slice(end);
	input.focus();
	input.setSelectionRange(start, end);
	let command = text === "" ? "delete" : "insertText";
	let applied = start === end && text === "" ? true : execute(input, command, text);
	if (applied && input.value === expected) return;
	input.value = expected;
	input.setSelectionRange(start + text.length, start + text.length);
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Turns the field's text into `next` with the smallest replacement that does it, then selects
 * `start`–`end` of the new text, so a formatting change undoes as one step.
 *
 * @param input The field to edit.
 * @param next The whole text it should hold.
 * @param start The selection's start in `next`.
 * @param end The selection's end in `next`.
 */
export function rewriteText(
	input: HTMLTextAreaElement,
	next: string,
	start: number,
	end: number,
): void {
	let current = input.value;
	let prefix = 0;
	let limit = Math.min(current.length, next.length);
	while (prefix < limit && current[prefix] === next[prefix]) prefix += 1;
	let suffix = 0;
	while (
		suffix < limit - prefix &&
		current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
	) {
		suffix += 1;
	}
	if (current !== next) {
		replaceText(input, prefix, current.length - suffix, next.slice(prefix, next.length - suffix));
	}
	input.focus();
	input.setSelectionRange(start, end);
}

/**
 * Runs an editing command on the focused field. `execCommand` is deprecated but remains the
 * one way to edit a text field that the browser's undo history records.
 *
 * @returns Whether the browser carried the command out.
 */
function execute(input: HTMLTextAreaElement, command: string, text: string): boolean {
	let document = input.ownerDocument;
	if (document.activeElement !== input || typeof document.execCommand !== "function") return false;
	return document.execCommand(command, false, text);
}
