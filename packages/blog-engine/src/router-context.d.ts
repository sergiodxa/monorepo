/**
 * Ambient module augmentation declaring the `formData` request-context value the
 * global `formData()` middleware attaches. Kept separate from the middleware modules
 * that own `db`/`logger`/`oidc` because an ambient `.d.ts` is not pulled in
 * transitively by consumers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {} from "remix/fetch-router";

/**
 * The `formData` context value from the `formData()` middleware's
 * `property: "formData"` transform (installed globally in `engine.ts`).
 *
 * `db`, `logger`, and `oidc` augmentations live in their own middleware modules so
 * they are applied by consumers that compile the engine's source (an ambient
 * `.d.ts` is not pulled in transitively).
 */
declare module "remix/fetch-router" {
	interface RequestContext {
		/** Parsed request body form data. */
		formData: FormData;
	}
}

export {};
