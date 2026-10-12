/**
 * The tail of the app's middleware chain a test router installs to render pages: the document
 * assets the shell links and the renderer, which resolves each frame back through the router
 * the test dispatches against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { render } from "remix/middleware/render";

import documentShellAssets from "~/app/http/middleware/assets";
import { assetResolver } from "~/app/initializers/assets";
import { logRenderFailure } from "~/app/initializers/logger";

/**
 * The app's `ctx.assets` and `ctx.render` middleware, in the router's order, typed as plain
 * `Middleware` so every test router shares one `Router` type. Installed after
 * `securityHeaders()`, the document carries the response's nonce as it does in production.
 */
export function documentRendering(): Middleware[] {
	return [
		documentShellAssets as Middleware,
		render({ assets: assetResolver, onError: logRenderFailure }) as Middleware,
	];
}
