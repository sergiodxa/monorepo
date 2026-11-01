/**
 * Tests that the catalogue leads readers to every demo landing and every demo docs site, each
 * of which answers, so a demo added as a folder is listed and reachable without editing a page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoDocsHref, listDemoDocsSites, listDemoDocsSlugs } from "~/resources/views/demo-docs";
import { listDemoSlugs } from "~/resources/views/demos";

describe("demo landing links", () => {
	test("the catalogue holds a SaaS, an app and a book demo", () => {
		expect(listDemoSlugs()).toEqual(expect.arrayContaining(["app", "book", "saas"]));
	});

	test.each(["/api/ui/landing-components", "/api/ui/landing-patterns"])(
		"%s links every demo, and each one answers",
		async (page) => {
			let body = await (await fetchApp(page)).text();

			for (let slug of listDemoSlugs()) {
				expect(body).toContain(`href="/demo/${slug}"`);
				expect((await fetchApp(`/demo/${slug}`)).status).toBe(200);
			}
		},
	);

	test("the catalogue holds a content, component, utilities and API docs demo", async () => {
		expect(listDemoDocsSlugs()).toEqual(
			expect.arrayContaining(["driftwood", "lattice", "parcelo", "tempo"]),
		);
		expect((await listDemoDocsSites()).map((site) => site.kind).sort()).toEqual([
			"API reference",
			"Component docs",
			"Content docs",
			"Utilities docs",
		]);
	});

	test.each(["/api/ui/docs-layout", "/api/ui/docs-nav", "/docs/content-and-feeds/reference-docs"])(
		"%s links every demo docs site, and each one answers",
		async (page) => {
			let body = await (await fetchApp(page)).text();

			for (let slug of listDemoDocsSlugs()) {
				let href = demoDocsHref(slug)();
				expect(body).toContain(`href="${href}"`);
				expect((await fetchApp(href)).status).toBe(200);
			}
		},
	);
});
