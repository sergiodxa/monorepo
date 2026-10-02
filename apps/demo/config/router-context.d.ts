import type { RemixNode } from "remix/component";
/**
 * Router context values installed by globally-applied middleware. `bootstrap/app.tsx`
 * installs `formData()` and `renderWith(createHtmlRenderer)`; both populate the context
 * through a transform rather than through a route handler's own typing, so this
 * augmentation is what surfaces them to a controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
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
