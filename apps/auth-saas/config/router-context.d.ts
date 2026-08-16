import type {} from "remix/router";

/**
 * Router context values installed by globally-applied middleware.
 *
 * The platform router (`bootstrap/app.ts`) installs `formData()` in its root
 * middleware chain, which populates the context through a `property: "formData"`
 * transform. Because route handlers are typed with the router's default context
 * (see `app/lib/action.ts`), this augmentation surfaces that value the same way the
 * `db`/`logger`/session middleware augment `RequestContext` from their own modules.
 * (The tenant Durable Object's OIDC surface is served by `@pkg/oidc-provider`, which
 * carries its own context augmentations.)
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare module "remix/router" {
	interface RequestContext {
		/** Parsed request body form data, present for every routed request. */
		formData: FormData;
	}
}

export {};
