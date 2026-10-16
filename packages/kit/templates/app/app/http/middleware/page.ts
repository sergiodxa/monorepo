/**
 * The middleware every page declares: the parsed form body, the cross-origin check a
 * cookie-backed form relies on, and the document's assets and renderer. A page controller
 * passes it as its `middleware`, so only requests that render a document pay for it.
 */

import { assets } from "@sdxc/assets-middleware";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createMiddleware } from "remix/router";

import { assetResolver } from "~/app/initializers/assets";

/** Publishes `ctx.formData`, `ctx.assets` and `ctx.render` on a page's context. */
export default createMiddleware(
	formData(),
	cop(),
	assets(assetResolver, {
		stylesheets: "resources/layouts/document.tsx",
		script: "bootstrap/browser.ts",
	}),
	render({ assets: assetResolver }),
);
