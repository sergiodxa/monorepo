/**
 * Tests `GET /robots.txt` through the real router: every page stays crawlable, the AI usage
 * preferences evaluate to `search=y` for any crawler, and the sitemap is on the canonical origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contentUsage, isAllowed, parse } from "@sdxc/robots";
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

describe("GET /robots.txt", () => {
	test("allows every page and states search=y with train-ai unset", async () => {
		let response = await fetchApp("/robots.txt");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/plain");

		let document = parse(await response.text());
		expect(isAllowed(document, "ExampleBot/1.0", "/docs")).toBe(true);
		expect(contentUsage(document, "ExampleBot/1.0", "/docs")).toEqual({ search: true });
		expect(document.sitemaps).toEqual(["https://sdxc.dev/sitemap.xml"]);
	});
});
