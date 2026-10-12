/**
 * Installs the document assets on a test router the way the app's router does, so a page
 * composed into the document layout renders the tags the test asset manifest names and a
 * stand-in renderer streams the page's node unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AssetsOptions } from "@sdxc/assets-middleware";

import { assets } from "@sdxc/assets-middleware";

import { assetResolver } from "~/app/initializers/assets";

/**
 * The `assets()` middleware over the app's resolver and document paths, publishing
 * `ctx.assets` for the handlers after it. Place it ahead of the renderer in the chain.
 *
 * @param nonce Reads the CSP nonce, for a test whose chain sets security headers.
 * @example createRouter({ middleware: [testAssets(), renderWith(createTestRenderer)] })
 */
export function testAssets(nonce?: AssetsOptions["nonce"]) {
	return assets(assetResolver, {
		stylesheets: "resources/layouts/document.tsx",
		script: "bootstrap/browser.ts",
		nonce,
	});
}
