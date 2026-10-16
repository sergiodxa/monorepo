/**
 * The search palette's page-wide behaviour, attached by the palette island on every page:
 * the shortcuts that open and close it, closing on a backdrop click where `closedby` is
 * missing, and closing once a navigation lands or the page enters the back/forward cache.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** What a keystroke asks of the dialog: toggle it, open it, close it, or nothing. */
export type SearchShortcut = "toggle" | "open" | "close" | null;

/** Elements whose own typing a `/` belongs to. */
const EDITABLE_SELECTOR =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Reads a keystroke as a search shortcut. ⌘K or Ctrl+K toggles the palette from anywhere;
 * `/` only opens it, and only from outside a field, so typing a slash stays typing; Escape
 * closes it, even from a search box that would spend it clearing itself.
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

/**
 * Attaches the shortcuts, ahead of whatever element has focus; a click that both starts and
 * ends on the backdrop closing the dialog, so a text selection dragged out of the panel
 * leaves it open; closing once a soft navigation settles, since the document stays and so
 * would the backdrop; and on `pagehide`, so a page restored from the cache comes back closed.
 * Every listener ends with `signal`.
 *
 * @param dialog The palette's dialog.
 * @param signal Ends every listener, as the island unmounts.
 */
export function watchSearchDialog(dialog: HTMLDialogElement, signal: AbortSignal): void {
	document.addEventListener(
		"keydown",
		(event) => {
			let shortcut = searchShortcut(event, dialog.open);
			if (shortcut === null) return;

			event.preventDefault();
			if (shortcut === "open" || (shortcut === "toggle" && !dialog.open)) dialog.showModal();
			else dialog.close();
		},
		{ signal, capture: true },
	);

	let pressedOnBackdrop = false;
	dialog.addEventListener(
		"pointerdown",
		(event) => {
			pressedOnBackdrop = event.target === dialog;
		},
		{ signal },
	);
	dialog.addEventListener(
		"click",
		(event) => {
			if (pressedOnBackdrop && event.target === dialog) dialog.close();
			pressedOnBackdrop = false;
		},
		{ signal },
	);

	globalThis.navigation?.addEventListener("navigatesuccess", () => dialog.close(), { signal });
	globalThis.navigation?.addEventListener("navigateerror", () => dialog.close(), { signal });
	window.addEventListener("pagehide", () => dialog.close(), { signal });
}
