/**
 * Covers the article list's delete: its confirm form must post with `_method=DELETE`, the
 * override the router reads, since a browser sends a form's unknown method as a GET that only
 * reloads the list and deletes nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { ArticleViewModel } from "~/app/http/view-models/cms/articles";
import { pageRenderer } from "~/app/test/renderer";
import routes from "~/routes/web";

import { CMSArticlesIndexView } from "./articles";

/** Renders the article list through the renderer production hands the controller. */
async function renderList(model: CMSArticlesIndexView.Props) {
	let router = createRouter({ middleware: pageRenderer() });

	router.get("/cms/articles", (ctx) => ctx.render(CMSArticlesIndexView, model));

	let response = await router.fetch(new Request("https://blog.test/cms/articles"));
	return await response.text();
}

describe("the article list's delete", () => {
	test("posts to the article with the DELETE override", async () => {
		let items = ArticleViewModel.index({
			items: [{ id: "a1", title: "A Post", slug: "a-post", preview: false, publishedAt: null }],
		});

		let html = await renderList({ items });

		let action = routes.cms.articles.destroy.href({ id: "a1" });
		let form = html.match(new RegExp(`<form[^>]*action="${action}"[^>]*>[\\s\\S]*?</form>`))?.[0];
		expect(form).toMatch(/method="post"/);
		expect(form).toContain(`name="_method" value="DELETE"`);
	});
});
