/**
 * Tests the app's security policy on a rendered document: the headers it sends, and the nonce it
 * names, which the assets middleware carries to the document's import map and which must match.
 * Also checks the document links the files the asset manifest names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { SecurityHeadersKey, securityHeaders } from "@sdxc/security-headers/middleware";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vite-plus/test";

import { assetResolver } from "~/app/initializers/assets";
import { CHUNK_SPECIFIER, CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/test/assets-manifest";
import { testAssets } from "~/app/test/document-assets";
import DocumentLayout from "~/resources/layouts/document";

import { SECURITY_POLICY } from "./security-policy";

/** Renders a document through the app's security headers, assets and renderer, as production does. */
async function renderSecuredDocument() {
	let router = createRouter({
		middleware: [
			securityHeaders(SECURITY_POLICY) as Middleware,
			testAssets((ctx) => ctx.get(SecurityHeadersKey)?.nonce),
			render({ assets: assetResolver }),
		],
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

describe("SECURITY_POLICY on a rendered document", () => {
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
