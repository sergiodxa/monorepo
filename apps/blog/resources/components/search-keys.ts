/**
 * The search dialog's page-wide behaviour, attached by the search box island that every page
 * hydrates: the shortcuts that open and close it, the trigger link opening it on wide screens,
 * and the fallbacks for closing it that older browsers lack. Each listener ends with `signal`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { WIDE_SCREEN } from "~/resources/components/nav-pill";
import {
	SEARCH_DIALOG_ID,
	SEARCH_SHORTCUT_ATTRIBUTE,
	SEARCH_TRIGGER_ATTRIBUTE,
} from "~/resources/components/search-trigger";

/**
 * Whether a click on the trigger opens the dialog: a plain primary click on a wide screen.
 * A modifier or another button keeps the link's own meaning, such as a new tab for `/search`.
 */
export function opensDialog(event: MouseEvent): boolean {
	if (event.defaultPrevented || event.button !== 0) return false;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	return matchMedia(WIDE_SCREEN).matches;
}

/** What a keystroke asks of the dialog: toggle it, open it, close it, or nothing. */
export type SearchShortcut = "toggle" | "open" | "close" | null;

/** Elements whose own typing a `/` belongs to. */
const EDITABLE_SELECTOR =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Reads a keystroke as a search shortcut. ⌘K or Ctrl+K toggles the dialog from anywhere, as
 * a command palette does; `/` only opens it, and only from outside a field, so typing a slash
 * stays typing; Escape closes it, even from a search box that would spend it clearing itself.
 *
 * @param event The `keydown` the document received.
 * @param open Whether the dialog is showing.
 * @returns The action the keystroke stands for, or `null` for any other key.
 */
export function searchShortcut(event: KeyboardEvent, open: boolean): SearchShortcut {
	if (event.repeat || event.altKey) return null;

	if (event.key === "Escape") return open ? "close" : null;

	if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
		return "toggle";
	}

	if (event.key !== "/" || event.metaKey || event.ctrlKey || open) return null;
	if (event.target instanceof Element && event.target.closest(EDITABLE_SELECTOR)) return null;
	return "open";
}

/** Whether the visitor's keyboard prints ⌘, judged from the platform the browser reports. */
export function hasAppleKeyboard(): boolean {
	return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
}

/** The search dialog, when the page carries one. */
export function searchDialog(): HTMLDialogElement | null {
	let dialog = document.getElementById(SEARCH_DIALOG_ID);
	return dialog instanceof HTMLDialogElement ? dialog : null;
}

/**
 * Closes the dialog when a click both starts and ends on the backdrop, which is where the
 * `<dialog>` element itself is the target; a drag that starts inside the panel, such as a
 * text selection, leaves it open. Complements `closedby="any"` where browsers lack it.
 */
export function watchBackdropClicks(signal: AbortSignal): void {
	let pressedOnBackdrop = false;

	document.addEventListener(
		"pointerdown",
		(event) => {
			pressedOnBackdrop =
				event.target instanceof HTMLDialogElement && event.target.id === SEARCH_DIALOG_ID;
		},
		{ signal },
	);

	document.addEventListener(
		"click",
		(event) => {
			let dialog = searchDialog();
			if (pressedOnBackdrop && dialog?.open && event.target === dialog) dialog.close();
			pressedOnBackdrop = false;
		},
		{ signal },
	);
}

/** Applies the keys {@link searchShortcut} reads, ahead of whatever element has focus. */
export function watchKeys(signal: AbortSignal): void {
	document.addEventListener(
		"keydown",
		(event) => {
			let dialog = searchDialog();
			if (dialog === null) return;

			let shortcut = searchShortcut(event, dialog.open);
			if (shortcut === null) return;

			event.preventDefault();
			if (shortcut === "open" || (shortcut === "toggle" && !dialog.open)) dialog.showModal();
			else dialog.close();
		},
		{ signal, capture: true },
	);
}

/** Opens the dialog for a plain click on the trigger link on a wide screen, in place of `/search`. */
export function watchTriggerClicks(signal: AbortSignal): void {
	document.addEventListener(
		"click",
		(event) => {
			let trigger =
				event.target instanceof Element
					? event.target.closest(`[${SEARCH_TRIGGER_ATTRIBUTE}]`)
					: null;
			let dialog = searchDialog();
			if (trigger === null || dialog === null || !opensDialog(event)) return;

			event.preventDefault();
			if (!dialog.open) dialog.showModal();
		},
		{ signal },
	);
}

/** Prints the trigger's hint as Ctrl K on a keyboard without ⌘; the page renders ⌘K. */
export function labelShortcut(): void {
	if (hasAppleKeyboard()) return;
	for (let hint of document.querySelectorAll(`[${SEARCH_SHORTCUT_ATTRIBUTE}]`)) {
		hint.textContent = "Ctrl K";
	}
}

/**
 * Attaches everything above, plus closing the dialog on `pagehide`, so a page restored from
 * the back/forward cache comes back closed.
 */
export function watchSearchDialog(signal: AbortSignal): void {
	labelShortcut();
	watchKeys(signal);
	watchBackdropClicks(signal);
	watchTriggerClicks(signal);
	window.addEventListener("pagehide", () => searchDialog()?.close(), { signal });
}
