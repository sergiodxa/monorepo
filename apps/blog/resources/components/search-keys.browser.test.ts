/**
 * Tests the search dialog's page-wide behaviour: the dialog closes once a soft navigation
 * from one of its results settles, so the page that loads never sits under its backdrop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import { watchSearchDialog } from "~/resources/components/search-keys";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-trigger";

describe("watchSearchDialog", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	test.each(["navigatesuccess", "navigateerror"])(
		"a soft navigation that ends in %s closes the dialog and its backdrop",
		(type) => {
			let navigation = new EventTarget();
			vi.stubGlobal("navigation", navigation);
			let dialog = document.createElement("dialog");
			dialog.id = SEARCH_DIALOG_ID;
			document.body.appendChild(dialog);
			let controller = new AbortController();
			watchSearchDialog(controller.signal);
			dialog.showModal();

			navigation.dispatchEvent(new Event(type));

			expect(dialog.open).toBe(false);
			controller.abort();
		},
	);
});
