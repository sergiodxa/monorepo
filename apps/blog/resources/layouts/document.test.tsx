/**
 * Covers the asset tags the document shell writes: every page links the files the asset
 * manifest names, since a build renames them with every change to their contents, and the
 * client entry loads `async` behind a matching preload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/test/assets-manifest";
import { htmlRenderer } from "~/bootstrap/app";
import { CMSDashboardView } from "~/resources/views/cms/dashboard";

/** Renders a page composed into the document through the renderer production uses. */
async function renderPage() {
	let router = createRouter({ middleware: htmlRenderer() });

	router.get("/cms", (ctx) =>
		ctx.render(CMSDashboardView, {
			stats: { articles: 0, likes: 0, tutorials: 0, glossary: 0 },
		}),
	);

	let response = await router.fetch(new Request("https://blog.test/cms"));
	return await response.text();
}

describe("the document's asset tags", () => {
	test("links the stylesheet the asset manifest names", async () => {
		let html = await renderPage();

		expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
	});

	test("preloads the client entry and loads it as an async module", async () => {
		let html = await renderPage();

		expect(html).toContain(`<link rel="modulepreload" href="${CLIENT_ENTRY_HREF}"`);
		expect(html).toContain(`<script type="module" async src="${CLIENT_ENTRY_HREF}">`);
	});

	test("declares the import map before any module loads", async () => {
		let html = await renderPage();

		expect(html.indexOf('type="importmap"')).toBeGreaterThan(-1);
		expect(html.indexOf('type="importmap"')).toBeLessThan(html.indexOf('rel="modulepreload"'));
	});
});
