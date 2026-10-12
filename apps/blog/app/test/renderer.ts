/**
 * The page-rendering middleware the blog's router installs, for a test router that maps only
 * the routes under test: the document's assets, Remix's `render()` and the view renderer, in
 * the order the router runs them, so a test page links what a production page links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { assets } from "@sdxc/assets-middleware";
import { render } from "remix/middleware/render";

import { viewRenderer } from "~/app/http/middleware/view-renderer";
import { assetResolver } from "~/app/initializers/assets";

/**
 * Creates the three middleware a page needs to answer through `ctx.render`, resolving the same
 * document modules the router does against the test asset manifest.
 *
 * @returns The middleware, in the order they must run.
 */
export function pageRenderer() {
	return [
		assets(assetResolver, {
			stylesheets: "resources/layouts/document.tsx",
			script: "bootstrap/browser.ts",
		}),
		render({ assets: assetResolver }),
		viewRenderer(),
	] as const;
}
