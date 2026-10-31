/**
 * Tests `/docs/:slug`: every page in the registry renders its title, a heading for each
 * entry in its rail and no untranslated key, gated pages name their plan, the page ends on
 * a hand-picked next step, and an unknown slug answers the help 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import show from "~/app/http/controllers/docs/show";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { DOC_PAGES, docHref } from "~/resources/docs/registry";
import routes from "~/routes/web";

/** A router with the help pages mapped and nobody signed in, as a visitor arrives. */
function createRouter(): AppRouter {
	let router = createTestRouter(null);
	router.map(routes.docs.show, show);
	return router;
}

describe("GET /docs/:slug", () => {
	test.each(DOC_PAGES.map((page) => page.slug))("renders %s", async (slug) => {
		let page = DOC_PAGES.find((candidate) => candidate.slug === slug)!;
		let module = await page.load();
		let response = await fetchRoute(createRouter(), docHref(slug));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html.replace(/&#x27;|&#39;/g, "'")).toContain(`>${page.title}<`);
		expect(html.match(/\b(docs|landing)\.[a-z]+\.[a-zA-Z.]+/g)).toBeNull();
		for (let item of module.TOC) expect(html).toContain(`id="${item.id}"`);
	});

	test("says which plan a gated page needs, linked to the plan table", async () => {
		let response = await fetchRoute(createRouter(), docHref("folders"));
		let html = await response.text();

		expect(html).toContain('data-slot="plan-notice"');
		expect(html).toContain(`href="${docHref("plans")}"`);
		expect(html).toContain("Paid and Premium plans");
	});

	test("ends every page with its hand-picked next pages and the vote", async () => {
		let response = await fetchRoute(createRouter(), docHref("getting-started"));
		let html = await response.text();

		expect(html).toContain('data-slot="next-steps"');
		expect(html).toContain(`href="${docHref("import-opml")}"`);
		expect(html).toContain('id="docs-feedback"');
	});

	test("hands every next step to a page that exists", () => {
		let slugs = new Set(DOC_PAGES.map((page) => page.slug));
		for (let page of DOC_PAGES) {
			for (let next of page.next) expect(slugs.has(next), `${page.slug} → ${next}`).toBe(true);
		}
	});

	test("thanks a reader who just voted in place of the form", async () => {
		let response = await fetchRoute(createRouter(), `${docHref("plans")}?feedback=sent`);
		let html = await response.text();

		expect(html).toContain('data-state="sent"');
	});

	test("answers a slug nobody wrote with the help 404 and suggestions", async () => {
		let response = await fetchRoute(createRouter(), "/docs/telepathy");
		let html = await response.text();

		expect(response.status).toBe(404);
		expect(html).toContain('data-slot="docs-not-found"');
		expect(html).toContain(`href="${docHref("getting-started")}"`);
	});
});
