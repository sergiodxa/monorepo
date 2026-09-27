/**
 * Covers what `/robots.txt` tells a crawler: the public site is open, the login-guarded
 * CMS and auth routes are closed, and the sitemap is found on the requesting host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isAllowed, parse } from "@sdxc/robots";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import routes from "../../routes.js";

import robots from "./robots.js";

/** Fetches `/robots.txt` from the given host and parses it. */
async function fetchRobots(origin = "https://blog.example.com") {
	let router = createRouter();
	router.map(routes.robots, robots);
	let response = await router.fetch(new Request(`${origin}/robots.txt`));
	return { response, document: parse(await response.text()) };
}

describe("GET /robots.txt", () => {
	test("serves plain text", async () => {
		let { response } = await fetchRobots();

		expect(response.headers.get("content-type")).toContain("text/plain");
	});

	test.each(["/", "/articles/hello-world", "/rss.xml", "/authors/jane", "/cms-notes"])(
		"allows %s",
		async (path) => {
			let { document } = await fetchRobots();

			expect(isAllowed(document, "Googlebot", path)).toBe(true);
		},
	);

	test.each(["/cms", "/cms/types/article/posts", "/auth/login", "/auth/callback"])(
		"disallows %s",
		async (path) => {
			let { document } = await fetchRobots();

			expect(isAllowed(document, "Googlebot", path)).toBe(false);
		},
	);

	test("points at the sitemap on the requesting host", async () => {
		let { document } = await fetchRobots("https://custom.example.org");

		expect(document.sitemaps).toEqual(["https://custom.example.org/sitemap.xml"]);
	});
});
