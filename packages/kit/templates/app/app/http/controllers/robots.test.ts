/**
 * `/robots.txt`, fetched through the app's router.
 */

import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

describe("robots", () => {
	test("lets every crawler in and points it at the sitemap on SITE_URL", async () => {
		let response = await createWebRouter().fetch("https://preview.example.net/robots.txt");

		let body = await response.text();
		expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(body).toContain("User-agent: *");
		expect(body).toContain("Sitemap: https://example.com/sitemap.xml");
	});
});
