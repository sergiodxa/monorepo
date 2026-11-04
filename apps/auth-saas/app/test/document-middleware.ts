/**
 * The document middleware a test router installs to render hosted pages as the tenant router
 * does: the hosted document's assets published as `ctx.assets`, then `ctx.render`, both over
 * the app's resolver, which tests point at the test asset manifest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { assets } from "@sdxc/assets-middleware";
import { getCspNonce } from "remix/middleware/csp";
import { render } from "remix/middleware/render";

import { assetResolver } from "~/app/initializers/assets";

/**
 * Builds `assets()` and `render()` with the tenant router's options, in the order they run;
 * install it after Remix's `csp()` so the import map carries the response's nonce.
 *
 * @returns The two middleware, `assets()` first.
 * @example createRouter({ middleware: [csp(…), securityHeaders(policy), ...hostedDocumentMiddleware()] });
 */
export function hostedDocumentMiddleware(): Middleware[] {
	return [
		assets(assetResolver, {
			stylesheets: "resources/views/hosted/document.tsx",
			script: "bootstrap/browser.ts",
			nonce: (ctx) => getCspNonce(ctx),
		}) as Middleware,
		render({ assets: assetResolver }) as Middleware,
	];
}
