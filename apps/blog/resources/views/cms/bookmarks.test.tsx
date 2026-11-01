/**
 * Covers the bookmark screens' markup: the list's review queue tab and the flag it shows, the
 * edit page's confirmed delete, and the conflict a save refused for a taken URL links to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { pageRenderer } from "~/app/test/renderer";
import routes from "~/routes/web";

import { CMSBookmarksActionView, CMSBookmarksIndexView } from "./bookmarks";

const VALUES = { title: "A Page", url: "https://site.com/page", description: "" };

/** Renders the bookmark form through the renderer production hands the controller. */
async function renderForm(model: CMSBookmarksActionView.Props) {
	let router = createRouter({ middleware: pageRenderer() });

	router.get("/cms/bookmarks/form", (ctx) => ctx.render(CMSBookmarksActionView, model));

	let response = await router.fetch(new Request("https://blog.test/cms/bookmarks/form"));
	return await response.text();
}

/** Renders the bookmarks list at `search`, inside a request so the list reads its query. */
async function renderList(items: CMSBookmarksIndexView.Item[], search = "") {
	let router = createRouter({ middleware: [asyncContext(), ...pageRenderer()] });

	router.get("/cms/bookmarks", (ctx) => ctx.render(CMSBookmarksIndexView, { items }));

	let response = await router.fetch(new Request(`https://blog.test/cms/bookmarks${search}`));
	return await response.text();
}

/** A list row for bookmark `id`, unflagged and never read unless `overrides` says so. */
function item(
	id: string,
	overrides: Partial<CMSBookmarksIndexView.Item> = {},
): CMSBookmarksIndexView.Item {
	return {
		id,
		title: `Bookmark ${id}`,
		url: `https://site.com/${id}`,
		href: routes.cms.bookmarks.edit.href({ id }),
		deleteAction: routes.cms.bookmarks.destroy.href({ id }),
		savedAt: "2026-10-01T00:00:00.000Z",
		status: null,
		httpStatus: null,
		finalUrl: null,
		...overrides,
	};
}

describe("the bookmarks list's review queue", () => {
	let rows = [
		item("kept", { status: "ok", httpStatus: 200 }),
		item("moved", {
			status: "moved",
			httpStatus: 301,
			finalUrl: "https://elsewhere.com/page",
			flag: "moved",
		}),
	];

	test("the Needs review tab counts the flagged bookmarks and links to status=review", async () => {
		let html = await renderList(rows);

		expect(html).toContain("Needs review");
		expect(html).toContain(`href="/cms/bookmarks?status=review"`);
		expect(html).toContain("Bookmark kept");
		expect(html).toContain("Bookmark moved");
	});

	test("status=review lists only the flagged bookmarks, with their status code and new address", async () => {
		let html = await renderList(rows, "?status=review");

		expect(html).not.toContain("Bookmark kept");
		expect(html).toContain("Bookmark moved");
		expect(html).toContain("301");
		expect(html).toContain("https://elsewhere.com/page");
	});
});

describe("the bookmark form's delete", () => {
	test("an edit offers a confirmed delete targeting the bookmark", async () => {
		let deleteAction = routes.cms.bookmarks.destroy.href({ id: "b1" });
		let html = await renderForm({
			title: "A Page",
			description: "Editing.",
			mode: "edit",
			action: routes.cms.bookmarks.update.href({ id: "b1" }),
			submitLabel: "Save bookmark",
			deleteAction,
			values: VALUES,
		});

		expect(html).toContain(`action="${deleteAction}"`);
		expect(html).toContain(`name="_method" value="DELETE"`);
		expect(html).toContain("Delete this bookmark?");
	});

	test("a new bookmark has nothing to delete", async () => {
		let html = await renderForm({
			title: "New bookmark",
			description: "Paste a URL.",
			mode: "new",
			action: routes.cms.bookmarks.index.href(),
			submitLabel: "Create bookmark",
			values: VALUES,
		});

		expect(html).not.toContain(`value="DELETE"`);
		expect(html).not.toContain("Delete this bookmark?");
	});
});

describe("the bookmark form's conflict", () => {
	test("a refused save links to the bookmark holding the URL", async () => {
		let holder = routes.cms.bookmarks.edit.href({ id: "b2" });
		let html = await renderForm({
			title: "A Page",
			description: "Another bookmark already holds this URL.",
			mode: "edit",
			action: routes.cms.bookmarks.update.href({ id: "b1" }),
			submitLabel: "Save bookmark",
			values: VALUES,
			conflict: { label: "The Original", href: holder },
		});

		expect(html).toContain(`href="${holder}"`);
		expect(html).toContain("The Original");
		expect(html).toContain(`name="_method" value="PUT"`);
	});
});
