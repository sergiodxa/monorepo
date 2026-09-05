/**
 * Ambient module augmentation declaring the `formData` request-context value the
 * global `formData()` middleware attaches. Kept separate from the middleware modules
 * that own `db`/`oidc` because an ambient `.d.ts` is not pulled in
 * transitively by consumers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {} from "remix/router";

/**
 * The `formData` context value the `formData()` middleware's `property: "formData"`
 * transform attaches, installed globally in `engine.ts`.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Parsed request body form data. */
		formData: FormData;
	}
}

export {};
