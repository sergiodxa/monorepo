/**
 * Tests for the keys the search dialog answers to from anywhere on a page: ⌘K or Ctrl+K
 * toggles it, `/` opens it only where a slash is not text being typed, and Escape closes it;
 * and the dialog closes once a link it led to has loaded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import { opensDialog, searchShortcut, watchSearchDialog } from "~/resources/components/search-keys";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-trigger";

/** A `keydown` as the document would receive it, aimed at `target`. */
function keydown(init: KeyboardEventInit, target?: Element): KeyboardEvent {
	let event = new KeyboardEvent("keydown", init);
	if (target) Object.defineProperty(event, "target", { value: target });
	return event;
}

describe("searchShortcut", () => {
	test("⌘K and Ctrl+K toggle the dialog whether it is open or not", () => {
		expect(searchShortcut(keydown({ key: "k", metaKey: true }), false)).toBe("toggle");
		expect(searchShortcut(keydown({ key: "K", ctrlKey: true }), true)).toBe("toggle");
	});

	test("a held key or an extra modifier is no shortcut", () => {
		expect(searchShortcut(keydown({ key: "k", metaKey: true, repeat: true }), false)).toBeNull();
		expect(searchShortcut(keydown({ key: "k", metaKey: true, shiftKey: true }), false)).toBeNull();
		expect(searchShortcut(keydown({ key: "k", metaKey: true, altKey: true }), false)).toBeNull();
	});

	test("a slash opens the dialog from the page, and stays text inside a field", () => {
		expect(searchShortcut(keydown({ key: "/" }, document.body), false)).toBe("open");
		expect(
			searchShortcut(keydown({ key: "/" }, document.createElement("input")), false),
		).toBeNull();
		expect(searchShortcut(keydown({ key: "/" }, document.body), true)).toBeNull();
	});

	test("Escape closes an open dialog and is left alone otherwise", () => {
		expect(searchShortcut(keydown({ key: "Escape" }), true)).toBe("close");
		expect(searchShortcut(keydown({ key: "Escape" }), false)).toBeNull();
	});
});

describe("opensDialog", () => {
	test("a plain click opens the dialog, and a modified one follows the link", () => {
		expect(opensDialog(new MouseEvent("click", { button: 0 }))).toBe(true);
		expect(opensDialog(new MouseEvent("click", { button: 0, metaKey: true }))).toBe(false);
		expect(opensDialog(new MouseEvent("click", { button: 1 }))).toBe(false);
	});
});

describe("watchSearchDialog", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	/** An open search dialog, watched until the returned controller aborts. */
	function openDialog(): { dialog: HTMLDialogElement; controller: AbortController } {
		let dialog = document.createElement("dialog");
		dialog.id = SEARCH_DIALOG_ID;
		document.body.appendChild(dialog);
		let controller = new AbortController();
		watchSearchDialog(controller.signal);
		dialog.showModal();
		return { dialog, controller };
	}

	test.each(["navigatesuccess", "navigateerror"])(
		"a soft navigation that ends in %s closes the dialog and its backdrop",
		(type) => {
			let navigation = new EventTarget();
			vi.stubGlobal("navigation", navigation);
			let { dialog, controller } = openDialog();

			navigation.dispatchEvent(new Event(type));

			expect(dialog.open).toBe(false);
			controller.abort();
		},
	);
});

describe("watchSearchDialog after the header is redrawn", () => {
	afterEach(() => document.body.replaceChildren());

	test("⌘K opens the dialog the page carries now, not the one it carried when watching began", () => {
		let first = document.createElement("dialog");
		first.id = SEARCH_DIALOG_ID;
		document.body.appendChild(first);
		let controller = new AbortController();
		watchSearchDialog(controller.signal);

		let second = document.createElement("dialog");
		second.id = SEARCH_DIALOG_ID;
		first.replaceWith(second);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));

		expect(second.open).toBe(true);
		controller.abort();
	});
});
