/**
 * Covers the asset tags the document shell writes through the renderer production uses: every
 * page links the stylesheet the asset manifest names, since a build renames it with every
 * change to its contents, and a hydrating page declares the import map before any module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/lib/test/assets-manifest";
import { createHtmlRenderer } from "~/bootstrap/app";
import DocumentLayout from "~/resources/layouts/document";

/** Renders an empty page composed into the document, hydrating it when asked. */
async function renderPage(hydrates: boolean) {
	let router = createRouter();

	router.get("/", (ctx) =>
		createHtmlRenderer(ctx)(
			<DocumentLayout title="Books" canonical="https://books.test/" hydrates={hydrates}>
				<main />
			</DocumentLayout>,
		),
	);

	let response = await router.fetch(new Request("https://books.test/"));
	return await response.text();
}

describe("the document's asset tags", () => {
	test("links the stylesheet the asset manifest names", async () => {
		let html = await renderPage(false);

		expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
	});

	test("links no client entry on a page without an island", async () => {
		let html = await renderPage(false);

		expect(html).not.toContain(CLIENT_ENTRY_HREF);
		expect(html).not.toContain('type="importmap"');
	});

	test("preloads the client entry and loads it as a module on a hydrating page", async () => {
		let html = await renderPage(true);

		expect(html).toContain(`<link rel="modulepreload" href="${CLIENT_ENTRY_HREF}"`);
		expect(html).toContain(`<script type="module" src="${CLIENT_ENTRY_HREF}">`);
	});

	test("declares the import map before any module loads", async () => {
		let html = await renderPage(true);

		expect(html.indexOf('type="importmap"')).toBeGreaterThan(-1);
		expect(html.indexOf('type="importmap"')).toBeLessThan(html.indexOf('rel="modulepreload"'));
		expect(html.indexOf('type="importmap"')).toBeLessThan(html.indexOf('type="module"'));
	});
});
