/**
 * Tests the request-scoped renderer's response contract, as opposed to the markup its
 * nodes produce. Chiefly the doctype: it is not part of the JSX tree — the renderer
 * prepends it to the byte stream — so no page or layout test can see it, and without it
 * every page in the app parses in quirks mode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createRouter } from "remix/router";

import DocumentLayout from "~/resources/layouts/document";

import { createHtmlRenderer } from "./render";

/**
 * Fetches a full document through the real renderer. Routed rather than called with a
 * hand-built context, so the renderer is handed the same `RequestContext` production
 * gives it.
 */
async function renderDocument() {
	let router = createRouter();

	router.get("/", (ctx) =>
		createHtmlRenderer(ctx)(
			<DocumentLayout title="Test">
				<p>Body</p>
			</DocumentLayout>,
		),
	);

	return await router.fetch(new Request("https://uptime.test/"));
}

describe("createHtmlRenderer", () => {
	test("the document starts with the doctype, before anything else", async () => {
		let response = await renderDocument();
		let html = await response.text();

		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(html.indexOf("<html")).toBe("<!DOCTYPE html>".length);
	});

	test("keeps the HTML content type", async () => {
		let response = await renderDocument();

		expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
	});
});
