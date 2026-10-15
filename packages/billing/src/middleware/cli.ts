/**
 * `@sdxc/cli` middleware that publishes the app's billing provider to a command as
 * `ctx.billing`, so an admin command grants an entitlement or looks up a customer through the
 * same platform a route bills against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyCommandContext, CommandMiddleware } from "@sdxc/cli";

import type { Billing } from "../core/contract.js";

import { CurrentBilling } from "./context.js";

export { CurrentBilling } from "./context.js";

/** Options that configure the command-line billing middleware. */
export interface BillingCommandOptions {
	/**
	 * The platform to bill against, or a factory resolving one per run from the command's
	 * context, such as one that reads the platform's access token from `ctx.env`.
	 */
	provider: Billing | ((ctx: AnyCommandContext) => Billing);
}

/**
 * Publishes the run's billing platform as `ctx.billing`.
 *
 * @param options - The provider, or a per-run factory.
 * @returns A middleware that installs `ctx.billing`.
 * @example createCLI({ name: "app", commands, middleware: [billing({ provider: polar })] });
 */
export default function billing(
	options: BillingCommandOptions,
): CommandMiddleware<{ key: typeof CurrentBilling; value: Billing; property: "billing" }> {
	return async (ctx, next) => {
		let provider =
			typeof options.provider === "function" ? options.provider(ctx) : options.provider;
		ctx.set(CurrentBilling, provider, { property: "billing" });
		await next();
	};
}
