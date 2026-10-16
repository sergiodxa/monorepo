// @vitest-environment happy-dom
/**
 * Tests for the keys the search palette answers to from anywhere on a page: ⌘K or Ctrl+K
 * toggles it, `/` opens it only where a slash is not text being typed, and Escape closes it;
 * and the palette closes once a link it led to has loaded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import { searchShortcut, watchSearchDialog } from "~/resources/components/search-keys";

/** A `keydown` as the document would receive it, aimed at `target`. */
function keydown(init: KeyboardEventInit, target?: Element): KeyboardEvent {
	let event = new KeyboardEvent("keydown", init);
	if (target) Object.defineProperty(event, "target", { value: target });
	return event;
}

describe("searchShortcut", () => {
	test("⌘K and Ctrl+K toggle the palette whether it is open or not", () => {
		expect(searchShortcut(keydown({ key: "k", metaKey: true }), false)).toBe("toggle");
		expect(searchShortcut(keydown({ key: "K", ctrlKey: true }), true)).toBe("toggle");
	});

	test("a held key or an extra modifier is no shortcut", () => {
		expect(searchShortcut(keydown({ key: "k", metaKey: true, repeat: true }), false)).toBeNull();
		expect(searchShortcut(keydown({ key: "k", metaKey: true, shiftKey: true }), false)).toBeNull();
		expect(searchShortcut(keydown({ key: "k", metaKey: true, altKey: true }), false)).toBeNull();
	});

	test("a slash opens the palette from the page, and stays text inside a field", () => {
		expect(searchShortcut(keydown({ key: "/" }, document.body), false)).toBe("open");
		expect(
			searchShortcut(keydown({ key: "/" }, document.createElement("input")), false),
		).toBeNull();
		expect(searchShortcut(keydown({ key: "/" }, document.body), true)).toBeNull();
	});

	test("Escape closes an open palette and is left alone otherwise", () => {
		expect(searchShortcut(keydown({ key: "Escape" }), true)).toBe("close");
		expect(searchShortcut(keydown({ key: "Escape" }), false)).toBeNull();
	});
});

describe("watchSearchDialog", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	/** An open palette dialog, watched until the returned controller aborts. */
	function openDialog(): { dialog: HTMLDialogElement; controller: AbortController } {
		let dialog = document.createElement("dialog");
		document.body.appendChild(dialog);
		let controller = new AbortController();
		watchSearchDialog(dialog, controller.signal);
		dialog.showModal();
		return { dialog, controller };
	}

	test.each(["navigatesuccess", "navigateerror"])(
		"a soft navigation that ends in %s closes the palette and its backdrop",
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
