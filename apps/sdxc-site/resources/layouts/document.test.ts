/**
 * Covers the asset tags the document shell writes: every page links the files the asset
 * manifest names, since a build renames them with every change to their contents, the
 * import map is declared before any module the browser may fetch through it, and the
 * Cloudflare Web Analytics beacon carries the site token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/test/assets-manifest";
import { fetchApp } from "~/app/test/router";

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

	test.each(PAGES)(
		"%s links the stylesheet ahead of every page-specific head tag",
		async (path) => {
			let html = await renderPage(path);
			let head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
			let viewport = head.indexOf('data-rmx-key="viewport" />');

			expect(head.indexOf(`<link rel="stylesheet"`)).toBe(
				viewport + 'data-rmx-key="viewport" />'.length,
			);
		},
	);

	test("names no client entry outside the manifest", async () => {
		let html = await renderPage("/");

		expect(html).not.toContain("/assets/clientEntry.js");
		expect(html).not.toContain("/bootstrap/browser.ts");
	});

	test("loads the Cloudflare Web Analytics beacon", async () => {
		let html = await renderPage("/");

		expect(html).toContain('src="https://static.cloudflareinsights.com/beacon.min.js"');
	});

	/**
	 * The renderer escapes the quotes inside the attribute value; the browser
	 * unescapes them before the beacon ever reads it, so the JSON it parses is
	 * `{"token": "b4283f4956eb4c7cb755a263acdf26fe"}`.
	 */
	test("hands the beacon the site token in the shape it parses", async () => {
		let html = await renderPage("/");

		expect(html).toContain(
			'data-cf-beacon="{&quot;token&quot;: &quot;b4283f4956eb4c7cb755a263acdf26fe&quot;}"',
		);
	});

	test("renders the beacon inside the body, after the page content", async () => {
		let html = await renderPage("/");

		expect(html.indexOf("cloudflareinsights")).toBeGreaterThan(html.indexOf("<body"));
		expect(html.indexOf("cloudflareinsights")).toBeGreaterThan(html.indexOf("</footer>"));
	});
});
