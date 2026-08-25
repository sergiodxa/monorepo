/**
 * Ambient router-context augmentations for the provider.
 *
 * Declares the `formData` value that the global `formData()` middleware attaches
 * to every request context, so controllers can read `context.formData` in a
 * type-safe way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "remix/router";

/**
 * `formData` comes from the globally installed `formData()` middleware;
 * other augmentations (e.g. `analytics`) live beside their own middleware,
 * since ambient `.d.ts` files apply only within the compiling project.
 */
declare module "remix/router" {
	interface RequestContext {
		formData: FormData;
	}
}

export {};
