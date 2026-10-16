/**
 * `/sitemap.xml`, fetched through the app's router.
 */

import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

describe("sitemap", () => {
	test("lists the home page at its canonical URL", async () => {
		let response = await createWebRouter().fetch("https://preview.example.net/sitemap.xml");

		expect(response.headers.get("content-type")).toBe("text/xml; charset=utf-8");
		expect(await response.text()).toContain("<loc>https://example.com/</loc>");
	});
});
