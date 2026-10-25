/**
 * Tests `/robots.txt`: every path stays crawlable, the AI usage preferences evaluate to
 * `search=y` for any crawler, and the sitemap is listed at the canonical origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestHandler } from "remix/router";

import { contentUsage, isAllowed, parse } from "@sdxc/robots";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import routes from "~/routes/web";

import robots from "./robots";

/** Requests the file from a router that maps only this controller. */
async function fetchRobots() {
	let router = createRouter();
	router.map(routes.robots, robots as RequestHandler<any>);
	return router.fetch(new Request("https://preview.example.com/robots.txt"));
}

describe("GET /robots.txt", () => {
	test("allows every path and states search=y with train-ai unset", async () => {
		let response = await fetchRobots();
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/plain");

		let document = parse(await response.text());
		expect(isAllowed(document, "ExampleBot/1.0", "/articles/anything")).toBe(true);
		expect(contentUsage(document, "ExampleBot/1.0", "/articles/anything")).toEqual({
			search: true,
		});
		expect(document.sitemaps).toEqual(["https://sergiodxa.com/sitemap.xml"]);
	});
});
