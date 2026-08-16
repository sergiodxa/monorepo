import type { Renderer } from "remix/middleware/render";
/**
 * Router context values installed by globally-applied middleware.
 *
 * `bootstrap/app.tsx` installs `formData()` and `renderWith(createHtmlRenderer)` in
 * its global middleware chain; both populate the context through transforms rather
 * than through the route handler's own typing. Route handlers are typed against the
 * router's plain default context, so this augmentation is what surfaces those values
 * — the same way `logger` augments `RequestContext` from its own middleware module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
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
