/**
 * Covers the asset tags the document shell writes: every page links the files the asset
 * manifest names, since a build renames them with every change to their contents, a page
 * that opts out of the client runtime ships no script at all, and an island hydrates from
 * the chunk the build emitted for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Middleware } from "remix/router";

import { render, renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { assets } from "~/app/lib/assets";
import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/lib/test/assets-manifest";
import { withDocumentAssets } from "~/bootstrap/app";
import { CopyButton } from "~/resources/components/copy-button";
import DocumentLayout from "~/resources/layouts/document";

/** Answers a page composed into the document through the renderer chain production uses. */
async function fetchPage(clientRuntime: boolean, body: RemixNode = <p>Body</p>) {
	let router = createRouter({
		middleware: [render({ assets }) as Middleware, renderWith(withDocumentAssets) as Middleware],
	});

	router.get("/page", (ctx) =>
		ctx.render(
			<DocumentLayout title="Page" clientRuntime={clientRuntime}>
				{body}
			</DocumentLayout>,
		),
	);

	return await router.fetch(new Request("https://auth.test/page"));
}

/** The markup of a page composed into the document. */
async function renderPage(clientRuntime: boolean, body?: RemixNode) {
	let response = await fetchPage(clientRuntime, body);
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

	test("starts with the doctype and is served as HTML", async () => {
		let response = await fetchPage(true);

		expect(response.headers.get("content-type")).toContain("text/html");
		expect(await response.text()).toMatch(/^<!DOCTYPE html>/i);
	});

	test("an island hydrates from the chunk the build emitted for its module", async () => {
		let html = await renderPage(
			true,
			<CopyButton value="secret" label="Copy" copiedLabel="Copied" />,
		);

		expect(html).toContain("/assets/resources/components/copy-button.js");
		expect(html).not.toContain("file:");
	});
});
