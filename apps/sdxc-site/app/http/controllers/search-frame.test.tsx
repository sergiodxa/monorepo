/**
 * Tests for `GET /frames/search`, the search dialog's body: the top matches with a tab per
 * kind, narrowed by `?kind=`, and a 200 whatever was typed, since it lands inside a dialog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { fetchApp } from "~/app/test/router";

/** The dialog body for `q`, on the tab `kind` when given. */
async function frame(q: string, kind?: string): Promise<{ status: number; body: string }> {
	let params = new URLSearchParams({ q });
	if (kind) params.set("kind", kind);
	let response = await fetchApp(`/frames/search?${params}`);
	return { status: response.status, body: await response.text() };
}

/** How many result rows the body lists. */
function rowCount(body: string): number {
	return [...body.matchAll(/id="site-search-options-\d+"/g)].length;
}

describe("GET /frames/search", () => {
	test("renders the box with no rows for a blank query", async () => {
		let { status, body } = await frame("");

		expect(status).toBe(200);
		expect(body).toContain('id="site-search-q"');
		expect(rowCount(body)).toBe(0);
	});

	test("lists at most five matches, a tab per kind, and a link to every match", async () => {
		let { body } = await frame("form");

		expect(rowCount(body)).toBe(5);
		expect(body).toContain('data-search-kind=""');
		expect(body).toContain('data-search-kind="ui"');
		expect(body).toMatch(/See all \d+ results/);
	});

	test("narrows the rows to the tab ?kind= names", async () => {
		let { body } = await frame("form", "guide");
		let rows = [...body.matchAll(/id="site-search-options-\d+"[^]*?href="([^"]+)"/g)].map(
			(match) => match[1],
		);

		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((href) => href?.startsWith("/docs/"))).toBe(true);
	});

	test("shows why a query cannot run, still answering 200", async () => {
		let { status, body } = await frame("-legacy");

		expect(status).toBe(200);
		expect(body).toContain("A search needs at least one term to find.");
	});
});
