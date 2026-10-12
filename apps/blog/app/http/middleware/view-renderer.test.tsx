/**
 * Tests the response the view renderer builds around a view. Chiefly the doctype: `render()`
 * prepends it to the byte stream, and every page needs it to parse in standards mode; and the
 * assets: the view receives the ones `assets()` published, which the document links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/test/assets-manifest";
import { pageRenderer } from "~/app/test/renderer";
import DocumentLayout from "~/resources/layouts/document";

function TestView() {
	return function TestPage({
		model,
		assets,
	}: {
		model: { title: string };
		assets: DocumentAssets;
	}) {
		return (
			<DocumentLayout title={model.title} assets={assets}>
				<p>Body</p>
			</DocumentLayout>
		);
	};
}

/**
 * Fetches a full document through the real renderer, routed so the renderer is
 * handed the same `RequestContext` production gives it.
 */
async function renderDocument() {
	let router = createRouter({ middleware: pageRenderer() });

	router.get("/", (ctx) => ctx.render(TestView, { title: "Test" }));

	return await router.fetch(new Request("https://blog.test/"));
}

describe("viewRenderer", () => {
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

	test("hands the view the document assets the request resolved", async () => {
		let html = await (await renderDocument()).text();

		expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
		expect(html).toContain(`<script type="module" async src="${CLIENT_ENTRY_HREF}">`);
	});
});
