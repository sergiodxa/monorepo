/**
 * Router context values installed by the global middleware in `app/initializers/router.tsx`:
 * `formData()` and Remix's `render()` populate the context through a transform, and this
 * declaration gives route handlers typed access to `render` and `formData`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type {} from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		/** Renders a `remix/component` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** The request's parsed `FormData`, populated by the global `formData()` middleware. */
		formData: FormData;
	}
}

export {};
