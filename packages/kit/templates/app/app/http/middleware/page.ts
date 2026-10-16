/**
 * The middleware every page declares: the parsed form body, the cross-origin check a
 * cookie-backed form relies on, the security headers, and the document's assets and renderer.
 * A page controller passes it as its `middleware`, so only requests that render a document pay for it.
 */

import { assets } from "@sdxc/assets-middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createMiddleware } from "remix/router";

import { assetResolver } from "~/app/initializers/assets";
import { SECURITY_POLICY } from "~/config/security-policy";

/**
 * Publishes `ctx.formData`, `ctx.securityHeaders`, `ctx.assets` and `ctx.render` on a page's
 * context. The security headers come right before the assets, whose nonce they generate, and
 * the renderer, whose response they decorate.
 */
export default createMiddleware(
	formData(),
	cop(),
	securityHeaders(SECURITY_POLICY),
	assets(assetResolver, {
		stylesheets: "resources/layouts/document.tsx",
		script: "bootstrap/browser.ts",
		nonce: (ctx) => ctx.securityHeaders.nonce,
	}),
	render({ assets: assetResolver }),
);
