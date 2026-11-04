/**
 * Checks the nonce against what `remix/component` renders: an `<ImportMap nonce>` keeps the nonce
 * on the managed import map script, matching the nonce Remix's `csp()` wrote into `script-src`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { ImportMap, renderToString } from "remix/component/server";
import { csp, getCspNonce } from "remix/middleware/csp";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

import { remixCsp } from "./remix.js";

test("the managed import map carries the nonce the CSP names", async () => {
	let router = createRouter({
		middleware: [
			csp({
				policy: ({ nonce }) => remixCsp({ scriptSrc: ["self", "nonce"] }, nonce),
			}),
		],
	});
	router.get("/", async (ctx) => {
		let nonce = getCspNonce(ctx);
		let html = await renderToString(
			<html lang="en">
				<head>
					<ImportMap value={{ imports: { app: "/app.js" } }} nonce={nonce} />
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
