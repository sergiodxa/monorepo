/**
 * Answers whether a page-level key such as Escape or a bare letter belongs to the list
 * behind it: a keystroke inside a text field, or while a dialog or popover is open, is that
 * surface's key, so a list's shortcuts stand aside for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Controls where a key is text: every editable field, and every `<input>` whose type takes
 * typed text. Checkboxes and radios stay out, so Escape after ticking a row still reaches the list.
 */
const TEXT_ENTRY_SELECTOR = [
	"textarea",
	"select",
	'[contenteditable]:not([contenteditable="false"])',
	'[role="textbox"]',
	'[role="combobox"]',
	'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="color"]):not([type="file"])',
].join(", ");

/** Surfaces that own Escape while open: a modal, or any shown popover. */
const OPEN_OVERLAY_SELECTOR = "dialog[open], :popover-open";

/**
 * Whether `target` is a field the reader is typing into.
 *
 * @param target The keystroke's target.
 * @returns Whether the target is, or sits inside, a text-entry control.
 */
export function isTextEntry(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR) !== null;
}

/**
 * Whether a keystroke is free for a list-level shortcut: unmodified, unclaimed by an earlier
 * handler, outside a text field, and with no dialog or popover open to take it first.
 *
 * @param event The keystroke.
 * @returns Whether a list shortcut may act on it.
 */
export function isListKey(event: KeyboardEvent): boolean {
	if (event.defaultPrevented || event.isComposing) return false;
	if (event.ctrlKey || event.metaKey || event.altKey) return false;
	if (isTextEntry(event.target)) return false;
	let root = event.target instanceof Node ? event.target.ownerDocument : null;
	return (root ?? document).querySelector(OPEN_OVERLAY_SELECTOR) === null;
}
