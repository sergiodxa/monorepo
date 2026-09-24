/**
 * Checks the nonce against what `remix/ui` renders: an `<ImportMap nonce>` keeps the nonce on
 * the managed import map script the client runtime reads it back from, and it matches the
 * nonce the middleware wrote into `script-src`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createRouter } from "remix/router";
import { ImportMap, renderToString } from "remix/ui/server";
import { expect, test } from "vitest";

import { securityHeaders } from "./middleware.js";

test("the managed import map carries the nonce the CSP names", async () => {
	let router = createRouter({
		middleware: [securityHeaders({ contentSecurityPolicy: { scriptSrc: ["self", "nonce"] } })],
	});
	router.get("/", async (ctx) => {
		let html = await renderToString(
			<html lang="en">
				<head>
					<ImportMap value={{ imports: { app: "/app.js" } }} nonce={ctx.securityHeaders.nonce} />
				</head>
				<body />
			</html>,
		);
		return new Response(html, { headers: { "content-type": "text/html" } });
	});

	let response = await router.fetch("https://example.com/");
	let html = await response.text();
	let nonce = /<script data-rmx-import-map type="importmap" nonce="([^"]+)">/.exec(html)?.[1];

	expect(nonce).toBeDefined();
	expect(response.headers.get("content-security-policy")).toBe(
		`script-src 'self' 'nonce-${nonce}'`,
	);
});
