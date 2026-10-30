/**
 * Tests that the marketing docs pages lead readers to every demo landing, each of which
 * answers, so a demo added as a folder is listed and reachable without editing either page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { listDemoSlugs } from "~/resources/views/demos";

describe("demo landing links", () => {
	test("the catalogue holds a SaaS, an app and a book demo", () => {
		expect(listDemoSlugs()).toEqual(expect.arrayContaining(["app", "book", "saas"]));
	});

	test.each(["/api/ui/marketing-components", "/api/ui/landing-patterns"])(
		"%s links every demo, and each one answers",
		async (page) => {
			let body = await (await fetchApp(page)).text();

			for (let slug of listDemoSlugs()) {
				expect(body).toContain(`href="/demo/${slug}"`);
				expect((await fetchApp(`/demo/${slug}`)).status).toBe(200);
			}
		},
	);
});
