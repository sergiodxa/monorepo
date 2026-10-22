/**
 * Tests the root document shell rendered through the app's assets middleware and renderer: the
 * doctype ahead of the markup, which keeps every page in standards mode, and the Cloudflare Web
 * Analytics beacon no page opts into, so no page test would notice it going missing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vite-plus/test";

import { assetResolver } from "~/app/initializers/assets";
import { testAssets } from "~/app/test/document-assets";

import DocumentLayout from "./document";

/**
 * Fetches a full document by routing a real request through the assets middleware and
 * renderer, so the layout receives the same `ctx.assets` production hands it.
 */
async function renderDocument() {
	let router = createRouter({
		middleware: [testAssets(), render({ assets: assetResolver })],
	});

	router.get("/", (ctx) =>
		ctx.render(
			<DocumentLayout assets={ctx.assets} title="Test">
				<p>Body</p>
			</DocumentLayout>,
		),
	);

	return await router.fetch(new Request("https://uptime.test/"));
}

describe("DocumentLayout", () => {
	test("the document starts with the doctype, before anything else", async () => {
		let html = await (await renderDocument()).text();

		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(html.indexOf("<html")).toBe("<!DOCTYPE html>".length);
	});

	test("keeps the HTML content type", async () => {
		let response = await renderDocument();

		expect(response.headers.get("content-type")?.toLowerCase()).toBe("text/html; charset=utf-8");
	});

	test("loads the Cloudflare Web Analytics beacon", async () => {
		let html = await (await renderDocument()).text();

		expect(html).toContain('src="https://static.cloudflareinsights.com/beacon.min.js"');
	});

	/**
	 * The renderer escapes the quotes inside the attribute value; the browser
	 * unescapes them before the beacon ever reads it, so the JSON it parses is
	 * `{"token": "2e915da0d572432eb502c32794ac1da6"}`.
	 */
	test("hands the beacon the site token in the shape it parses", async () => {
		let html = await (await renderDocument()).text();

		expect(html).toContain(
			'data-cf-beacon="{&quot;token&quot;: &quot;2e915da0d572432eb502c32794ac1da6&quot;}"',
		);
	});

	test("renders the beacon inside the body, after the page content", async () => {
		let html = await (await renderDocument()).text();

		expect(html.indexOf("cloudflareinsights")).toBeGreaterThan(html.indexOf("<body"));
		expect(html.indexOf("cloudflareinsights")).toBeGreaterThan(html.indexOf("Body"));
	});
});
