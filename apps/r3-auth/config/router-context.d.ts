/**
 * Router context values installed by globally-applied middleware that has no module
 * of its own to declare them in. `renderWith(createHtmlRenderer)` and `formData()`
 * are both configured in `bootstrap/app.tsx` and populate the context through their
 * own transforms, so route handlers — typed against the router's plain default
 * context — only see those values through this augmentation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

declare module "remix/fetch-router" {
	interface RequestContext {
		/** Renders a `remix/ui` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** The request's parsed `FormData`, populated by the global `formData()` middleware. */
		formData: FormData;
	}
}

export {};
