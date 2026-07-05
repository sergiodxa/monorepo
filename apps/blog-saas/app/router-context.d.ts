import type {} from "remix/fetch-router";

/**
 * The `formData` context value from the `formData()` middleware (installed in
 * `bootstrap/app.ts`). This ambient augmentation is program-wide, so it also covers
 * the `@pkg/blog-engine` sources compiled here (their own `router-context.d.ts` is
 * not pulled in transitively).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare module "remix/fetch-router" {
	interface RequestContext {
		/** Parsed request body form data. */
		formData: FormData;
	}
}

export {};
