import type {} from "remix/router";

/**
 * The `formData` context value from the `formData()` middleware (installed in
 * `bootstrap/app.ts`). This ambient augmentation is program-wide, extending
 * `formData` typing to every source file this program compiles, including
 * files from other packages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare module "remix/router" {
	interface RequestContext {
		/** Parsed request body form data. */
		formData: FormData;
	}
}

export {};
