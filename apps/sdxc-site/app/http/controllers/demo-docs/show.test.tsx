/**
 * Tests `GET /demo/docs/:site(/*page)` through the real router over every docs demo: each
 * hub and page answers `noindex`, every heading the rail lists exists on its page, search
 * finds a page by a heading's word, and a missing page answers the site's own 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoDocsHref, findDemoDocsSite, listDemoDocsSlugs } from "~/resources/views/demo-docs";

/** Every demo's slug with its site, loaded once for the table-driven tests below. */
let sites = await Promise.all(
	listDemoDocsSlugs().map(async (slug) => ({ slug, site: (await findDemoDocsSite(slug))! })),
);

describe("GET /demo/docs/:site", () => {
	test.each(sites)(
		"$slug's hub renders its start links and stays out of search",
		async ({ slug, site }) => {
			let response = await fetchApp(demoDocsHref(slug)());
			let body = await response.text();

			expect(response.status).toBe(200);
			expect(body).toMatch(/<meta name="robots" content="noindex, nofollow"/);
			for (let item of site.hub.start) expect(body).toContain(`href="${item.href}"`);
		},
	);

	test.each(sites)(
		"$slug's pages answer, and each rail heading exists on its page",
		async ({ slug, site }) => {
			for (let [path, page] of Object.entries(site.pages)) {
				let response = await fetchApp(demoDocsHref(slug)(path));
				let body = await response.text();

				expect(response.status, path).toBe(200);
				for (let item of page.toc) expect(body, `${path}#${item.id}`).toContain(`id="${item.id}"`);
			}
		},
	);

	test.each(sites)("every link in $slug's tree and next steps answers", async ({ slug, site }) => {
		let links = [
			...site.tree.sections.flatMap((section) => section.items.map((item) => item.href)),
			...Object.values(site.pages).flatMap((page) => (page.next ?? []).map((step) => step.href)),
			...site.hub.sections.map((section) => section.href),
		].filter((link): link is string => link !== undefined);

		for (let link of new Set(links.map((link) => link.split("#")[0]!))) {
			expect((await fetchApp(link)).status, link).toBe(200);
		}
		expect(links.every((link) => link.startsWith(demoDocsHref(slug)()))).toBe(true);
	});

	test.each(sites)("$slug's search finds a page by its title", async ({ slug, site }) => {
		let page = Object.values(site.pages)[0]!;
		let word = page.title.split(" ").find((part) => part.length > 3) ?? page.title;
		let body = await (
			await fetchApp(`${demoDocsHref(slug)("search")}?q=${encodeURIComponent(word)}`)
		).text();

		expect(body).toContain("result");
		expect(body).toContain(page.title.split(" ")[0]!);
	});

	test("a missing page answers 404 inside the site, with the search pre-filled", async () => {
		let response = await fetchApp("/demo/docs/driftwood/guides/custom-domain-setup");
		let body = await response.text();

		expect(response.status).toBe(404);
		expect(body).toContain('value="custom domain setup"');
		expect(body).toContain("Driftwood");
	});

	test("an unknown site answers the site's 404", async () => {
		expect((await fetchApp("/demo/docs/no-such-site")).status).toBe(404);
		expect((await fetchApp("/demo/docs/constructor")).status).toBe(404);
	});
});
