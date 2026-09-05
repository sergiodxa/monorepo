/**
 * Augments `remix/router`'s `RequestContext` with the values installed by this
 * app's globally-applied middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type {} from "remix/router";
import type { RemixNode } from "remix/ui";

/**
 * `bootstrap/app.tsx` installs `renderWith(createHtmlRenderer)` in its global middleware
 * chain, populating this context the same way `log`/`team`/`membership`/`language` do
 * from their own modules — route handlers are typed against the router's plain context.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Renders a `remix/ui` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** The request's parsed `FormData`, populated by the global `formData()` middleware. */
		formData: FormData;
	}
}

export {};
