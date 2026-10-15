/**
 * Covers the tutorial edit page's subtitle: an edit links the saved post's public URL so the
 * author can open it in one click, while the new-tutorial form shows its description alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { TutorialViewModel } from "~/app/http/view-models/cms/tutorials";
import { pageRenderer } from "~/app/test/renderer";
import routes from "~/routes/web";

import { CMSTutorialsActionView } from "./tutorials";

/** Renders the tutorial form through the renderer production hands the controller. */
async function renderForm(model: CMSTutorialsActionView.Props) {
	let router = createRouter({ middleware: pageRenderer() });

	router.get("/cms/tutorials/form", (ctx) => ctx.render(CMSTutorialsActionView, model));

	let response = await router.fetch(new Request("https://blog.test/cms/tutorials/form"));
	return await response.text();
}

describe("the tutorial form's subtitle", () => {
	test("an edit links the tutorial's public URL", async () => {
		let html = await renderForm(
			TutorialViewModel.edit({
				tutorial: { id: "t1", title: "A Tool", slug: "a-tool", published_at: null },
			}),
		);

		let href = routes.post.href({ postType: "tutorials", postSlug: "a-tool" });
		expect(html).toMatch(new RegExp(`<a [^>]*href="${href}"[^>]*>${href}</a>`));
	});

	test("a new tutorial has no public URL to link", async () => {
		let html = await renderForm(TutorialViewModel.new({}));

		expect(html).toContain("Write a new tutorial");
		expect(html).not.toContain(`href="/tutorials/`);
	});
});
