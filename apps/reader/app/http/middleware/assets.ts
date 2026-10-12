/**
 * Publishes `ctx.assets`: the stylesheets the document layout imports, the client entry, and
 * the response's CSP nonce for the inline import map, resolved once per request so every page
 * hands its document the same lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { assets } from "@sdxc/assets-middleware";
import { SecurityHeadersKey } from "@sdxc/security-headers/middleware";

import { isFrameRequest } from "~/app/http/frames";
import { assetResolver } from "~/app/initializers/assets";

/**
 * Resolves the document's assets. It goes after `securityHeaders()`, whose nonce it reads; a
 * fragment renders no shell, so a frame request carries none, and a chain without the security
 * headers, as in a test router, carries none either.
 */
export const documentShellAssets = assets(assetResolver, {
	stylesheets: "resources/layouts/document.tsx",
	script: "bootstrap/browser.ts",
	nonce: (ctx) =>
		isFrameRequest(ctx.request) || !ctx.has(SecurityHeadersKey)
			? undefined
			: ctx.get(SecurityHeadersKey)?.nonce,
});

export default documentShellAssets;
