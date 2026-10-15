/**
 * Remix fetch-router middleware that publishes the configured newsletter on the
 * request context, so a route reaches its list through `context.newsletter` and
 * a test installs a memory provider in its place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import type { Newsletter } from "./contract.js";

import { CurrentNewsletter } from "./context.js";

export { CurrentNewsletter } from "./context.js";

/**
 * Declared here, in an imported module rather than an ambient .d.ts, so the
 * augmentation is applied in consuming projects that import the middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** The newsletter the current request subscribes readers to. */
		newsletter: Newsletter;
	}
}

/** Options that configure the newsletter middleware. */
export interface NewsletterMiddlewareOptions {
	/**
	 * The list to publish, or a factory resolving one per request for an app
	 * whose list varies by tenant.
	 */
	provider: Newsletter | ((context: RequestContext) => Newsletter);
}

/**
 * Creates a middleware that publishes the request's newsletter as `context.newsletter`, under
 * the {@link CurrentNewsletter} key the command-line entry shares.
 *
 * @param options - The provider, or a per-request factory.
 * @returns A middleware that populates `context.newsletter`.
 * @example
 * let router = createRouter({ middleware: [newsletter({ provider: buttondown })] });
 */
export default function newsletter(options: NewsletterMiddlewareOptions): Middleware {
	return async (context, next) => {
		let provider =
			typeof options.provider === "function" ? options.provider(context) : options.provider;
		context.set(CurrentNewsletter, provider, { property: "newsletter" });

		return next();
	};
}
