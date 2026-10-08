/**
 * Covers the asset tags the document shell writes: every page links the files the asset
 * manifest names, since a build renames them with every change to their contents, and a page
 * that opts out of the client runtime ships no script at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/lib/test/assets-manifest";
import { createHtmlRenderer } from "~/bootstrap/app";
import DocumentLayout from "~/resources/layouts/document";

/** Renders a page composed into the document through the renderer production uses. */
async function renderPage(clientRuntime: boolean) {
	let router = createRouter();

	router.get("/page", (ctx) =>
		createHtmlRenderer(ctx)(
			<DocumentLayout title="Page" clientRuntime={clientRuntime}>
				<p>Body</p>
			</DocumentLayout>,
		),
	);

	let response = await router.fetch(new Request("https://auth.test/page"));
	return await response.text();
}

describe("the document's asset tags", () => {
	test("links the stylesheet the asset manifest names", async () => {
		let html = await renderPage(true);

		expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
	});

	test("preloads the client entry and loads it as a module", async () => {
		let html = await renderPage(true);

		expect(html).toContain(`<link rel="modulepreload" href="${CLIENT_ENTRY_HREF}"`);
		expect(html).toContain(`<script type="module" src="${CLIENT_ENTRY_HREF}">`);
	});

	test("declares the import map before any module loads", async () => {
		let html = await renderPage(true);
		let importMap = html.indexOf('type="importmap"');

		expect(importMap).toBeGreaterThan(-1);
		expect(importMap).toBeLessThan(html.indexOf('rel="modulepreload"'));
		expect(importMap).toBeLessThan(html.indexOf('<script type="module"'));
	});

	test("a page without the client runtime still links the stylesheet and ships no script", async () => {
		let html = await renderPage(false);

		expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
		expect(html).not.toContain("<script");
		expect(html).not.toContain("modulepreload");
	});
});
