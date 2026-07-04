import type {} from "remix/fetch-router";

/**
 * Router context values installed by globally-applied middleware.
 *
 * Both the platform router (`src/app/router.ts`) and the tenant router
 * (`src/tenant/router.ts`) install `formData()` in their root middleware chain,
 * which populates the context through a `property: "formData"` transform. Because
 * route handlers are typed with the router's default context (see `src/lib/action.ts`),
 * this augmentation surfaces that value the same way the `db`/`logger`/session
 * middleware augment `RequestContext` from their own modules.
 */
declare module "remix/fetch-router" {
	interface RequestContext {
		/** Parsed request body form data, present for every routed request. */
		formData: FormData;
	}
}

export {};
