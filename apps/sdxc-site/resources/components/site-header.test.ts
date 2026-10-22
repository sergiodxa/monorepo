// @vitest-environment happy-dom

/**
 * Tests the header's search dialog markup: the box and the quick links sit in one column of
 * the page's own inside the dialog, so their spacing holds on every page whatever order the
 * dialog's own styles arrive in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { fetchApp } from "~/app/test/router";
import { SEARCH_QUICK_LINKS_ID } from "~/resources/components/search-box";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-trigger";
import { SEARCH_DIALOG_INPUT_ID } from "~/resources/views/search-frame";

describe("SiteHeader's search dialog", () => {
	test("spaces the box and the quick links in a column of its own", async () => {
		let html = await (await fetchApp("/docs")).text();
		let page = document.createElement("template");
		page.innerHTML = html.slice(html.indexOf("<body"), html.lastIndexOf("</body>"));
		let dialog = page.content.getElementById(SEARCH_DIALOG_ID);
		let column = dialog?.firstElementChild;

		expect(dialog?.children).toHaveLength(1);
		expect(column?.tagName).toBe("DIV");
		expect(column?.querySelector(`#${SEARCH_DIALOG_INPUT_ID}`)).not.toBeNull();
		expect(column?.querySelector(`#${SEARCH_QUICK_LINKS_ID}`)).not.toBeNull();
	});
});
