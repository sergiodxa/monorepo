/**
 * Router context values installed by globally-applied middleware.
 *
 * The platform router's root middleware populates `formData` via a
 * `property: "formData"` transform, augmenting `RequestContext` the same way
 * `db`, `logger`, and session middleware augment it from their own modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {} from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		/** Parsed request body form data, present for every routed request. */
		formData: FormData;
	}
}

export {};
