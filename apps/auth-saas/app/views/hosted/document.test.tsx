/**
 * Covers the asset tags the hosted document writes through the app's real renderer: every
 * page links the files the asset manifest names, since a build renames them with every
 * change, and the import map and module tags carry the nonce the response's CSP allows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { securityHeaders } from "@sdxc/security-headers/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import render from "~/app/http/middleware/render";
import { TENANT_SECURITY_POLICY } from "~/app/http/security-policy";
import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/test/assets-manifest";

import { HostedDocument } from "./document";

/** Renders a hosted page under the tenant policy, answering its HTML and the CSP's nonce. */
async function renderPage() {
	let router = createRouter({
		middleware: [securityHeaders(TENANT_SECURITY_POLICY) as Middleware, render as Middleware],
	});

	router.get("/", (ctx) =>
		ctx.render(
			<HostedDocument title="Sign in" locale="en">
				<p>Hosted screen</p>
			</HostedDocument>,
		),
	);

	let response = await router.fetch(new Request("https://tenant.example.com/"));
	let policy = response.headers.get("Content-Security-Policy-Report-Only") ?? "";
	let nonce = /'nonce-([^']+)'/.exec(policy)?.[1];

	return { html: await response.text(), nonce };
}

describe("the hosted document's asset tags", () => {
	test("links the stylesheet the asset manifest names", async () => {
		let { html } = await renderPage();

		expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
	});

	test("preloads the client entry and loads it as a module under the CSP nonce", async () => {
		let { html, nonce } = await renderPage();

		expect(nonce).toBeDefined();
		expect(html).toContain(
			`<link rel="modulepreload" href="${CLIENT_ENTRY_HREF}" nonce="${nonce}"`,
		);
		expect(html).toContain(
			`<script type="module" async src="${CLIENT_ENTRY_HREF}" nonce="${nonce}"></script>`,
		);
	});

	test("declares the import map under the CSP nonce before any module loads", async () => {
		let { html, nonce } = await renderPage();
		let importMap = html.indexOf('type="importmap"');

		expect(importMap).toBeGreaterThan(-1);
		expect(/<script[^>]*type="importmap"[^>]*>/.exec(html)?.[0]).toContain(`nonce="${nonce}"`);
		expect(importMap).toBeLessThan(html.indexOf('rel="modulepreload"'));
		expect(importMap).toBeLessThan(html.indexOf('<script type="module"'));
	});
});
