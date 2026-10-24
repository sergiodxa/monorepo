/**
 * Tests the header's search dialog markup: the box and the quick links sit in one column of
 * the page's own inside the dialog, so their spacing holds on every page whatever order the
 * dialog's own styles arrive in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDocument } from "@sdxc/html/document";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { SEARCH_QUICK_LINKS_ID } from "~/resources/components/search-box";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-trigger";
import { SEARCH_DIALOG_INPUT_ID } from "~/resources/views/search-frame";

describe("SiteHeader's search dialog", () => {
	test("spaces the box and the quick links in a column of its own", async () => {
		let page = unwrap(parseDocument(await (await fetchApp("/docs")).text()));
		let dialog = page.querySelector(`#${SEARCH_DIALOG_ID}`);
		let column = dialog?.children[0];

		expect(dialog?.children).toHaveLength(1);
		expect(column?.localName).toBe("div");
		expect(column?.querySelector(`#${SEARCH_DIALOG_INPUT_ID}`)).not.toBeNull();
		expect(column?.querySelector(`#${SEARCH_QUICK_LINKS_ID}`)).not.toBeNull();
	});
});
