/**
 * Augments `remix/router`'s `RequestContext` with the values this app's globally-applied
 * middleware installs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type {} from "remix/router";
import type { RemixNode } from "remix/ui";

/**
 * `bootstrap/app.tsx` installs `formData()` and `renderWith(createHtmlRenderer)`, both of
 * which populate the context through a transform rather than through the route handler's
 * own typing, so this augmentation is what surfaces them to a controller.
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
