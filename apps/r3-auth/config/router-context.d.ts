/**
 * Router context values installed by middleware applied globally to the
 * app, declared here as the one place they get typed. `renderWith(createHtmlRenderer)`
 * and `formData()` are both configured in `bootstrap/app.tsx` and populate the
 * context through their own transforms, so route handlers see those values
 * through this augmentation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type {} from "remix/router";
import type { RemixNode } from "remix/ui";

declare module "remix/router" {
	interface RequestContext {
		/** Renders a `remix/ui` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** The request's parsed `FormData`, populated by the global `formData()` middleware. */
		formData: FormData;
	}
}

export {};
