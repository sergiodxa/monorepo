import type {} from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

/**
 * Router context values installed by globally-applied middleware.
 *
 * `bootstrap/app.tsx` installs `renderWith(createHtmlRenderer)` in its global
 * middleware chain (cast `as Middleware`, matching the rest of that chain), which
 * populates the context through a `property: "render"` transform. Because route
 * handlers are typed against the router's plain default context, this augmentation
 * surfaces that value the same way `logger`/`team`/`membership`/`language` augment
 * `RequestContext` from their own middleware modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare module "remix/fetch-router" {
	interface RequestContext {
		/** Renders a `remix/ui` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** The request's parsed `FormData`, populated by the global `formData()` middleware. */
		formData: FormData;
	}
}

export {};
