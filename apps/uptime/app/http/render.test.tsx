/**
 * Tests the rendering chain's response contract: the doctype ahead of the JSX-rendered markup,
 * which keeps every page in standards mode, the CSP nonce it hands the document, which must
 * match the one the response's policy names, and the asset manifest's files it links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { securityHeaders } from "@sdxc/security-headers/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { SECURITY_POLICY } from "~/app/http/security-policy";
import {
	CHUNK_SPECIFIER,
	CLIENT_ENTRY_HREF,
	STYLESHEET_HREF,
} from "~/app/lib/test/assets-manifest";
import DocumentLayout from "~/resources/layouts/document";

import { htmlRendering } from "./render";

/**
 * Fetches a full document by routing a real request through the renderer, so it
 * receives the same `RequestContext` production hands it.
 */
async function renderDocument() {
	let router = createRouter({ middleware: htmlRendering() });

	router.get("/", (ctx) =>
		ctx.render(
			<DocumentLayout title="Test">
				<p>Body</p>
			</DocumentLayout>,
		),
	);

	return await router.fetch(new Request("https://uptime.test/"));
}

describe("htmlRendering", () => {
	test("the document starts with the doctype, before anything else", async () => {
		let response = await renderDocument();
		let html = await response.text();

		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(html.indexOf("<html")).toBe("<!DOCTYPE html>".length);
	});

	test("keeps the HTML content type", async () => {
		let response = await renderDocument();

		expect(response.headers.get("content-type")?.toLowerCase()).toBe("text/html; charset=utf-8");
	});
});

describe("htmlRendering with the security policy", () => {
	/** Renders a document through the app's security headers and renderer, as production does. */
	async function renderSecuredDocument() {
		let router = createRouter({
			middleware: [securityHeaders(SECURITY_POLICY) as Middleware, ...htmlRendering()],
		});
		router.get("/", (ctx) =>
			ctx.render(
				<DocumentLayout title="Test">
					<p>Body</p>
				</DocumentLayout>,
			),
		);
		return await router.fetch(new Request("https://uptime.test/"));
	}

	test("stamps the import map with the nonce the Report-Only policy names", async () => {
		let response = await renderSecuredDocument();
		let html = await response.text();
		let policy = response.headers.get("Content-Security-Policy-Report-Only") ?? "";

		let nonce = /<script data-rmx-import-map type="importmap" nonce="([^"]+)"/.exec(html)?.[1];

		expect(nonce).toBeDefined();
		expect(policy).toContain(`'nonce-${nonce}'`);
		expect(policy).toContain("https://challenges.cloudflare.com");
		expect(policy).toContain("https://static.cloudflareinsights.com");
		expect(policy).toContain("report-to csp");
		expect(response.headers.get("Content-Security-Policy")).toBeNull();
	});

	test("links the stylesheet and client entry the asset manifest names", async () => {
		let html = await (await renderSecuredDocument()).text();

		expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
		expect(html).toContain(`<link rel="modulepreload" href="${CLIENT_ENTRY_HREF}"`);
		expect(html).toContain(`<script type="module" async src="${CLIENT_ENTRY_HREF}">`);
		expect(html).not.toContain("/assets/clientEntry.js");
	});

	test("declares the nonced import map before any module tag", async () => {
		let html = await (await renderSecuredDocument()).text();
		let importMap = /<script data-rmx-import-map type="importmap" nonce="[^"]+">([^<]*)</.exec(
			html,
		);

		expect(importMap).not.toBeNull();
		expect(JSON.parse(importMap?.[1] ?? "{}")).toEqual({
			imports: { [CHUNK_SPECIFIER]: CHUNK_SPECIFIER },
		});
		expect(importMap?.index).toBeLessThan(html.indexOf('rel="modulepreload"'));
		expect(importMap?.index).toBeLessThan(html.indexOf('<script type="module"'));
	});

	test("sends the headers the policy enforces now", async () => {
		let response = await renderSecuredDocument();

		expect(response.headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
		expect(response.headers.get("Reporting-Endpoints")).toBe('csp="/reports/csp"');
	});
});
