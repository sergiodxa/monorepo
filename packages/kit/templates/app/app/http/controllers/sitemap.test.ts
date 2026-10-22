/**
 * `/sitemap.xml`, fetched through the app's router.
 */

import { describe, expect, test } from "vite-plus/test";

import { createWebRouter } from "~/app/initializers/router";

describe("sitemap", () => {
	test("lists the home page at its canonical URL, cached for an hour", async () => {
		let response = await createWebRouter().fetch("https://preview.example.net/sitemap.xml");

		expect(response.headers.get("content-type")).toBe("text/xml; charset=utf-8");
		expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
		let body = await response.text();
		expect(body).toContain("<loc>https://example.com/</loc>");
		expect(body).toContain("<priority>1</priority>");
	});

	test("leaves out robots.txt and the sitemap itself", async () => {
		let response = await createWebRouter().fetch("https://preview.example.net/sitemap.xml");
		let body = await response.text();

		expect(body).not.toContain("robots.txt");
		expect(body).not.toContain("sitemap.xml");
		expect(body).not.toContain("preview.example.net");
	});
});
