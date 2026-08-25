/**
 * Tests the response the composition root's request-scoped renderer builds
 * around a view. Chiefly the doctype: the renderer prepends it to the byte
 * stream, and every page needs it to parse in standards mode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import DocumentLayout from "~/resources/layouts/document";

import { createHtmlRenderer } from "./app";

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
 * Fetches a full document through the real renderer, routed so the renderer is
 * handed the same `RequestContext` production gives it.
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
