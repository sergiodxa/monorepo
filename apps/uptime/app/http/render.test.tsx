/**
 * Tests the request-scoped renderer's response contract: the doctype the renderer
 * prepends to the byte stream ahead of the JSX-rendered markup. The doctype lives
 * outside the JSX tree, so verifying it here is what keeps every page in the app
 * parsing in standards mode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import DocumentLayout from "~/resources/layouts/document";

import { createHtmlRenderer } from "./render";

/**
 * Fetches a full document by routing a real request through the renderer, so it
 * receives the same `RequestContext` production hands it.
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
