/**
 * Tests for `GET /search`: the page a search lands on without script and where the dialog's
 * "See all" points, so it must page every match, narrow by `kind:`, and refuse what cannot run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { fetchApp } from "~/app/test/router";

describe("GET /search", () => {
	test("renders the form alone for a blank box", async () => {
		let response = await fetchApp("/search");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('action="/search"');
		expect(body).not.toContain("Search results");
	});

	test("lists the matches for a query, the package first for its own name", async () => {
		let response = await fetchApp("/search?q=result");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
		expect(body).toContain('aria-label="Search results"');
		expect(body.indexOf('href="/api/result"')).toBeGreaterThan(-1);
	});

	test("narrows to a kind with kind:", async () => {
		let body = await (
			await fetchApp(`/search?${new URLSearchParams({ q: "button kind:ui" })}`)
		).text();

		let results = body.match(/<section aria-label="Search results"[^]*?<\/section>/)?.[0] ?? "";

		expect(results).toContain('href="/api/ui/button"');
		expect(results).not.toMatch(/href="\/docs\//);
	});

	test("answers 400 with the reason for a query that cannot run", async () => {
		let response = await fetchApp(`/search?${new URLSearchParams({ q: "-legacy" })}`);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("A search needs at least one term to find.");
	});

	test("tags each query's page apart, so two searches never share a stored copy", async () => {
		let first = await fetchApp("/search?q=result");
		let second = await fetchApp("/search?q=router");

		expect(first.headers.get("ETag")).not.toBe(second.headers.get("ETag"));
	});
});
