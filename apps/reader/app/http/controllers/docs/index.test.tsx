/**
 * Tests the help hub at `/docs`: it routes a new reader to the quickstart first and lists
 * every section of the registry, each linking to its first page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import index from "~/app/http/controllers/docs/index";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { DOC_PAGES, DOC_SECTIONS, docHref } from "~/resources/docs/registry";
import routes from "~/routes/web";

describe("GET /docs", () => {
	test("starts with the quickstart and lists every section", async () => {
		let router = createTestRouter(null);
		router.map(routes.docs.index, index);

		let response = await fetchRoute(router, routes.docs.index.href());
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html.indexOf(docHref("getting-started"))).toBeGreaterThan(-1);
		for (let section of DOC_SECTIONS) {
			let first = DOC_PAGES.find((page) => page.section === section.key)!;
			expect(html).toContain(section.title);
			expect(html).toContain(`href="${docHref(first.slug)}"`);
		}
		expect(html.match(/\b(docs|landing)\.[a-z]+\.[a-zA-Z.]+/g)).toBeNull();
	});
});
