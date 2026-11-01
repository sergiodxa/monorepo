/**
 * Tests a docs demo page's Markdown twin: it carries the page's title, lead and outline as
 * Markdown, stays out of search engines, and a page no demo holds answers `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

describe("GET /demo/docs/:site/*page.md", () => {
	test("answers the page's title and outline as Markdown", async () => {
		let response = await fetchApp("/demo/docs/driftwood/start/quickstart.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/markdown");
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(body).toMatch(/^# Deploy your first site\n/);
		expect(body).toContain("- [Install the CLI](#install-the-cli)");
	});

	test("answers 404 for a page the demo doesn't hold", async () => {
		expect((await fetchApp("/demo/docs/driftwood/start/nothing.md")).status).toBe(404);
		expect((await fetchApp("/demo/docs/nowhere/start/quickstart.md")).status).toBe(404);
	});
});
