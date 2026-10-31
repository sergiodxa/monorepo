/**
 * Tests `GET /robots.txt`: the public site stays crawlable while the signed-in app, the API and
 * token-addressed pages do not, the AI usage preferences evaluate to `search=y`, and the sitemap
 * is on the production origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contentUsage, isAllowed, parse } from "@sdxc/robots";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import routes from "~/routes/web";

import robots from "./robots";

async function getRobots() {
	let router = createRouter();
	router.map(routes.robots, robots);
	return router.fetch(`https://uptime.sergiodxa.com${routes.robots.href()}`);
}

describe("GET /robots.txt", () => {
	test("serves plain text pointing at the production sitemap", async () => {
		let response = await getRobots();
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/plain");

		let document = parse(await response.text());
		expect(document.sitemaps).toEqual(["https://uptime.sergiodxa.com/sitemap.xml"]);
	});

	test("allows the public site and blocks private paths", async () => {
		let document = parse(await (await getRobots()).text());

		for (let path of ["/", "/features/ssl-monitoring", "/docs/overview", "/try", "/status/acme"]) {
			expect(isAllowed(document, "ExampleBot/1.0", path)).toBe(true);
		}
		for (let path of ["/app/acme", "/api/v1/monitors", "/try/report/abc", "/unsubscribe/abc"]) {
			expect(isAllowed(document, "ExampleBot/1.0", path)).toBe(false);
		}
	});

	test("states search=y with every other usage unset", async () => {
		let document = parse(await (await getRobots()).text());
		expect(contentUsage(document, "ExampleBot/1.0", "/")).toEqual({ search: true });
	});
});
