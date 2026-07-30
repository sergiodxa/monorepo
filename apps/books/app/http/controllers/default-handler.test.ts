/**
 * Tests the router's default handler: any request matching no route renders the 404 page
 * and asks not to be indexed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { fetchApp } from "~/app/lib/test/router";

describe("default handler", () => {
	test("renders the 404 page for an unmatched route", async () => {
		let response = await fetchApp("/this-route-does-not-exist");
		let body = await response.text();

		expect(response.status).toBe(404);
		expect(body).toContain("404");
		expect(body).toContain("The requested page could not be found.");
		expect(body).toContain('content="noindex, follow"');
	});
});
