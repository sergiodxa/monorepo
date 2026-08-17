/**
 * Tests the composition root's request-scoped renderer — the response it builds around a
 * view, rather than the markup the view produces. Chiefly the doctype: it is not part of
 * the JSX tree, the renderer prepends it to the byte stream, so no view or layout test
 * can see it, and without it every page in the app parses in quirks mode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import DocumentLayout from "~/resources/layouts/document";

import { createHtmlRenderer } from "./app";

/** The smallest thing shaped like an app view: a factory returning a model-taking component. */
function TestView() {
	return function TestPage({ model }: { model: { title: string } }) {
		return (
			<DocumentLayout title={model.title}>
				<p>Body</p>
			</DocumentLayout>
		);
	};
}

/**
 * Fetches a full document through the real renderer. Routed rather than called with a
 * hand-built context, so the renderer is handed the same `RequestContext` production
 * gives it.
 */
async function renderDocument() {
	let router = createRouter();

	router.get("/", (ctx) => createHtmlRenderer(ctx)(TestView, { title: "Test" }));

	return await router.fetch(new Request("https://blog.test/"));
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
