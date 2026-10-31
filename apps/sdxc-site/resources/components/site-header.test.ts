/**
 * Tests the header's markup: the search dialog keeps the box and the quick links in one
 * column of the page's own, the bar's menu button opens a sheet holding every destination,
 * which is the only way a phone reaches them, and the sheet ships the island that closes it.
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

describe("SiteHeader", () => {
	test("spaces the box and the quick links in a column of its own", async () => {
		let page = unwrap(parseDocument(await (await fetchApp("/docs")).text()));
		let dialog = page.querySelector(`#${SEARCH_DIALOG_ID}`);
		let column = dialog?.children[0];

		expect(dialog?.children).toHaveLength(1);
		expect(column?.localName).toBe("div");
		expect(column?.querySelector(`#${SEARCH_DIALOG_INPUT_ID}`)).not.toBeNull();
		expect(column?.querySelector(`#${SEARCH_QUICK_LINKS_ID}`)).not.toBeNull();
	});

	test("gives the bar a menu button that opens a sheet of every destination", async () => {
		let page = unwrap(parseDocument(await (await fetchApp("/philosophy")).text()));
		let button = page.querySelector('[data-slot="site-header-menu-button"]');
		let sheet = page.querySelector(`dialog#${button?.getAttribute("commandfor")}`);
		let rows = Array.from(sheet?.querySelectorAll("nav a") ?? [], (link) => link.textContent);

		expect(button?.getAttribute("command")).toBe("show-modal");
		expect(rows).toEqual(["Docs", "API", "Utilities", "Components", "GitHub"]);
	});

	test("hydrates the island that closes the sheet once a link in it is followed", async () => {
		let page = unwrap(parseDocument(await (await fetchApp("/philosophy")).text()));
		let islands = Array.from(page.querySelectorAll("script#rmx-data"), (script) => {
			let data = JSON.parse(script.textContent ?? "{}") as {
				h?: Record<string, { moduleUrl: string; exportName: string }>;
			};
			return Object.values(data.h ?? {});
		}).flat();

		expect(islands).toContainEqual(
			expect.objectContaining({
				moduleUrl: "@sdxc/ui/dialog-dismiss",
				exportName: "DialogDismiss",
			}),
		);
	});
});
