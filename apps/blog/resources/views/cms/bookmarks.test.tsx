/**
 * Covers the bookmark edit page's delete: an edit offers it, confirmed in a modal whose
 * form sends a DELETE to the bookmark, while the new-bookmark form has nothing to delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { pageRenderer } from "~/app/test/renderer";
import routes from "~/routes/web";

import { CMSBookmarksActionView } from "./bookmarks";

const VALUES = { title: "A Page", url: "https://site.com/page", description: "" };

/** Renders the bookmark form through the renderer production hands the controller. */
async function renderForm(model: CMSBookmarksActionView.Props) {
	let router = createRouter({ middleware: pageRenderer() });

	router.get("/cms/bookmarks/form", (ctx) => ctx.render(CMSBookmarksActionView, model));

	let response = await router.fetch(new Request("https://blog.test/cms/bookmarks/form"));
	return await response.text();
}

describe("the bookmark form's delete", () => {
	test("an edit offers a confirmed delete targeting the bookmark", async () => {
		let deleteAction = routes.cms.bookmarks.destroy.href({ id: "b1" });
		let html = await renderForm({
			title: "Edit Bookmark A Page",
			description: "Editing.",
			mode: "edit",
			action: routes.cms.bookmarks.update.href({ id: "b1" }),
			submitLabel: "Save Bookmark",
			deleteAction,
			values: VALUES,
		});

		expect(html).toContain(`action="${deleteAction}"`);
		expect(html).toContain(`name="_method" value="DELETE"`);
		expect(html).toContain("Confirm delete");
	});

	test("a new bookmark has nothing to delete", async () => {
		let html = await renderForm({
			title: "New Bookmark",
			description: "Paste a URL.",
			mode: "new",
			action: routes.cms.bookmarks.index.href(),
			submitLabel: "Create Bookmark",
			values: VALUES,
		});

		expect(html).not.toContain("Confirm delete");
	});
});
