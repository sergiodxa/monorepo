/**
 * What the router's global middleware adds to every request context: `render()` publishes
 * `ctx.render` and `formData()` publishes `ctx.formData`. Declaring them here lets the
 * default handler and any helper typed as `RequestContext` read them.
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type {} from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		/** Renders a `remix/component` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** The request's parsed form body. */
		formData: FormData;
	}
}

export {};
