import type {} from "remix/fetch-router";

/**
 * The `formData` context value, from the `formData()` middleware's
 * `property: "formData"` transform (installed globally in `provider.ts`).
 *
 * The `analytics` augmentation lives in `middleware/analytics.ts` instead of here
 * so it is applied by consuming projects that compile the provider's source (an
 * ambient `.d.ts` is not pulled in transitively).
 */
declare module "remix/fetch-router" {
	interface RequestContext {
		/** Parsed request body form data. */
		formData: FormData;
	}
}

export {};
