/**
 * Client island: the navigation's search trigger, a quiet search-field-shaped pill that
 * opens the search dialog through its native `commandfor`, plus the keys that drive the
 * dialog from anywhere on the page. The pill works without script; the keys need this island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { hidden } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { mis, pb, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { font, text } from "@sdxc/u/typography";
import { Button, Keyboard } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import { SearchGlyph } from "~/resources/components/search-glyph";

/** The dialog the trigger and every key open, which the layout renders with this id. */
export const SEARCH_DIALOG_ID = "site-search";

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
function hasAppleKeyboard(): boolean {
	return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
}

/** The search dialog, when the page carries one. */
function searchDialog(): HTMLDialogElement | null {
	let dialog = document.getElementById(SEARCH_DIALOG_ID);
	return dialog instanceof HTMLDialogElement ? dialog : null;
}

/**
 * Closes the dialog when a click both starts and ends on the backdrop, which is where the
 * `<dialog>` element itself is the target; a drag that starts inside the panel, such as a
 * text selection, leaves it open. Complements `closedby="any"` where browsers lack it.
 */
function watchBackdropClicks(signal: AbortSignal): void {
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
function watchKeys(signal: AbortSignal): void {
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

/**
 * The trigger: a magnifier, "Search", and the ⌘K hint, which prints as Ctrl K once script
 * finds a keyboard without ⌘. Its name and `aria-keyshortcuts` say the same to assistive
 * technology; on a narrow screen it is the magnifier alone, and on touch the hint hides.
 * Leaving the page closes the dialog, so a page restored from the back/forward cache comes
 * back closed.
 */
export const SearchTrigger = clientEntry(
	"/resources/components/search-trigger.tsx#SearchTrigger",
	function SearchTrigger(handle: Handle) {
		let modifier = "⌘";

		handle.queueTask(() => {
			if (!hasAppleKeyboard()) {
				modifier = "Ctrl ";
				void handle.update();
			}

			watchKeys(handle.signal);
			watchBackdropClicks(handle.signal);
			window.addEventListener("pagehide", () => searchDialog()?.close(), {
				signal: handle.signal,
			});
		});

		return () => (
			<Button
				type="button"
				color="neutral"
				variant="outline"
				size="sm"
				commandfor={SEARCH_DIALOG_ID}
				command="show-modal"
				aria-label="Search"
				aria-keyshortcuts="Meta+K Control+K /"
				mix={[
					mis("auto"),
					pi(3),
					pb(1),
					rounded("full"),
					border({ width: 1, color: "neutral" }),
					bg("neutral.bg-tint-hover"),
					fg("neutral.muted"),
					font("serif"),
					text("sm"),
					hover([fg("neutral.emphasis"), bg("neutral.bg-tint-hover")]),
					when("&:active", opacity(80)),
					/** Browsers without Invoker Commands ignore `command`, so script opens it there. */
					on<HTMLButtonElement, "click">("click", () => {
						if ("command" in HTMLButtonElement.prototype) return;
						let dialog = searchDialog();
						if (dialog && !dialog.open) dialog.showModal();
					}),
				]}
			>
				<SearchGlyph />
				<span mix={[media("(max-width: 40rem)", hidden())]}>Search</span>
				<Keyboard
					aria-hidden="true"
					mix={[
						mis(4),
						fg("neutral.muted"),
						bg("transparent"),
						media("(hover: none), (max-width: 40rem)", hidden()),
					]}
				>
					{modifier}K
				</Keyboard>
			</Button>
		);
	},
);
