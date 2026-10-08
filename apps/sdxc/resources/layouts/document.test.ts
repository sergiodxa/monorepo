/**
 * Covers the asset tags the document shell writes: every page links the files the asset
 * manifest names, since a build renames them with every change to their contents, and the
 * import map is declared before any module the browser may fetch through it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/lib/test/assets-manifest";
import { fetchApp } from "~/app/lib/test/router";

/** Pages that compose into the document from different layouts: landing, guide, policy. */
const PAGES = ["/", "/docs", "/security"];

/** Renders a page through the real router, and so through the renderer production uses. */
async function renderPage(path: string) {
	let response = await fetchApp(path);
	expect(response.status).toBe(200);
	return await response.text();
}

describe("the document's asset tags", () => {
	test.each(PAGES)("%s links the stylesheet the asset manifest names", async (path) => {
		let html = await renderPage(path);

		expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
	});

	test.each(PAGES)("%s preloads the client entry and loads it as an async module", async (path) => {
		let html = await renderPage(path);

		expect(html).toContain(`<link rel="modulepreload" href="${CLIENT_ENTRY_HREF}"`);
		expect(html).toContain(`<script type="module" async src="${CLIENT_ENTRY_HREF}">`);
	});

	test("declares the import map before any module loads", async () => {
		let html = await renderPage("/");
		let importMap = html.indexOf('type="importmap"');

		expect(importMap).toBeGreaterThan(-1);
		expect(importMap).toBeLessThan(html.indexOf('rel="modulepreload"'));
		expect(importMap).toBeLessThan(html.indexOf('<script type="module"'));
	});

	test("names no client entry outside the manifest", async () => {
		let html = await renderPage("/");

		expect(html).not.toContain("/assets/clientEntry.js");
		expect(html).not.toContain("/bootstrap/browser.ts");
	});
});
