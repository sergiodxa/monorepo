/**
 * Client island: the navigation's Search button, which opens the search dialog through its
 * native `commandfor`, plus the ⌘K / Ctrl+K and `/` shortcuts that open it from anywhere on
 * the page. The button works without script; only the shortcuts need this island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pb, pi } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import { Button, Keyboard } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** The dialog the button and every shortcut open, which the layout renders with this id. */
export const SEARCH_DIALOG_ID = "site-search";

/** What a keystroke asks of the dialog: toggle it, open it, or nothing at all. */
export type SearchShortcut = "toggle" | "open" | null;

/** Elements whose own typing a `/` belongs to. */
const EDITABLE_SELECTOR =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Reads a keystroke as a search shortcut. ⌘K or Ctrl+K toggles the dialog from anywhere, as
 * a command palette does; `/` only opens it, and only from outside a field, so typing a slash
 * into a form, or into the dialog's own box, stays typing.
 *
 * @param event The `keydown` the document received.
 * @returns The action the keystroke stands for, or `null` for any other key.
 */
export function searchShortcut(event: KeyboardEvent): SearchShortcut {
	if (event.repeat || event.defaultPrevented || event.altKey) return null;

	if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
		return "toggle";
	}

	if (event.key !== "/" || event.metaKey || event.ctrlKey) return null;
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
 * The Search button. It names its shortcuts in `aria-keyshortcuts` and draws the ⌘K hint as
 * decoration, printed as Ctrl K once script finds a keyboard without ⌘. Leaving the page
 * closes the dialog, so a page restored from the back/forward cache comes back closed.
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

			document.addEventListener(
				"keydown",
				(event) => {
					let shortcut = searchShortcut(event);
					let dialog = searchDialog();
					if (shortcut === null || dialog === null) return;

					event.preventDefault();
					if (dialog.open) {
						if (shortcut === "toggle") dialog.close();
					} else {
						dialog.showModal();
					}
				},
				{ signal: handle.signal },
			);

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
				aria-keyshortcuts="Meta+K Control+K /"
				mix={[
					text("sm"),
					font("serif"),
					pi(3),
					pb(1),
					rounded("full"),
					border({ width: 1, color: "neutral" }),
					bg("neutral.bg-tint-hover"),
					fg("neutral"),
					/** Browsers without Invoker Commands ignore `command`, so script opens it there. */
					on<HTMLButtonElement, "click">("click", () => {
						if ("command" in HTMLButtonElement.prototype) return;
						let dialog = searchDialog();
						if (dialog && !dialog.open) dialog.showModal();
					}),
				]}
			>
				Search
				<Keyboard aria-hidden="true">{modifier}K</Keyboard>
			</Button>
		);
	},
);
