/**
 * Tests the three overview pages of the `@sdxc/ui/docs` kit: each answers with its markdown
 * twin, they link one another, the components page reaches every docs component's own page,
 * and the patterns page links demo docs pages that answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { listComponents } from "~/app/services/components";
import { fetchApp } from "~/app/test/router";

/** Each overview's address and the heading it opens with. */
const OVERVIEWS = [
	["/api/ui/docs-foundations", "Docs foundations"],
	["/api/ui/docs-components", "Docs components"],
	["/api/ui/docs-patterns", "Docs patterns"],
] as const;

describe("docs overview pages", () => {
	test.each(OVERVIEWS)("%s answers with its title and a markdown twin", async (path, title) => {
		let page = await fetchApp(path);
		let body = await page.text();
		let markdown = await fetchApp(`${path}.md`);

		expect(page.status).toBe(200);
		expect(body).toContain(`<title>${title} — @sdxc/ui</title>`);
		expect(markdown.status).toBe(200);
		expect(await markdown.text()).toMatch(new RegExp(`^# ${title}\\n`));
	});

	test.each(OVERVIEWS)("%s is listed in the @sdxc/ui sidebar and index", async (path, title) => {
		let index = await (await fetchApp("/api/ui")).text();

		expect(index).toContain(`href="${path}"`);
		expect(index).toContain(title);
	});

	test("the components page links every docs component's own page", async () => {
		let body = await (await fetchApp("/api/ui/docs-components")).text();
		let docs = (await listComponents()).filter((entry) => entry.module === "docs");

		expect(docs.length).toBeGreaterThan(0);
		for (let entry of docs) expect(body).toContain(`href="/api/ui/${entry.slug}"`);
	});

	test("the foundations page links every docs mixin's page", async () => {
		let body = await (await fetchApp("/api/ui/docs-foundations")).text();

		for (let slug of [
			"toc-spy",
			"docs-nav-tools",
			"code-tabs-sync",
			"copy-from-url",
			"copy-feedback",
		]) {
			expect(body).toContain(`href="/api/ui/mixins/${slug}"`);
		}
	});

	test("every demo docs page the patterns page links answers, and the 404 one does not", async () => {
		let body = await (await fetchApp("/api/ui/docs-patterns")).text();
		let hrefs = [
			...new Set([...body.matchAll(/href="(\/demo\/docs\/[^"]+)"/g)].map((match) => match[1]!)),
		];

		expect(hrefs).toContain("/demo/docs/parcelo/shipments/create");
		for (let href of hrefs) {
			let expected = href === "/demo/docs/driftwood/guides/time-travel" ? 404 : 200;
			expect((await fetchApp(href)).status, href).toBe(expected);
		}
	});
});
