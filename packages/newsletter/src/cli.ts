/**
 * `@sdxc/cli` middleware that publishes the app's newsletter to a command as `ctx.newsletter`, so
 * an admin command subscribes or removes an address by hand through the same provider a route
 * uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyCommandContext, CommandMiddleware } from "@sdxc/cli";

import type { Newsletter } from "./contract.js";

import { CurrentNewsletter } from "./context.js";

export { CurrentNewsletter } from "./context.js";

/** Options that configure the command-line newsletter middleware. */
export interface NewsletterCommandOptions {
	/**
	 * The list to publish, or a factory resolving one per run from the command's context, such
	 * as one that reads the provider's API key from `ctx.env`.
	 */
	provider: Newsletter | ((ctx: AnyCommandContext) => Newsletter);
}

/**
 * Publishes the run's newsletter as `ctx.newsletter`.
 *
 * @param options - The provider, or a per-run factory.
 * @returns A middleware that installs `ctx.newsletter`.
 * @example createCLI({ name: "app", commands, middleware: [newsletter({ provider: buttondown })] });
 */
export default function newsletter(
	options: NewsletterCommandOptions,
): CommandMiddleware<{ key: typeof CurrentNewsletter; value: Newsletter; property: "newsletter" }> {
	return async (ctx, next) => {
		let provider =
			typeof options.provider === "function" ? options.provider(ctx) : options.provider;
		ctx.set(CurrentNewsletter, provider, { property: "newsletter" });
		await next();
	};
}
