/**
 * Publishes the platform's own configured sender address as `ctx.platformSender`, the
 * same address the mail middleware's `from` was itself built from. A hosted-flow
 * controller reads it back to build a per-tenant `from` override, rather than
 * re-reading the app's own configuration a second time — one value, set once, read
 * wherever a message is sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address } from "@sdxc/mail";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

export const PlatformSenderContext = createContextKey<Address>();

declare module "remix/router" {
	interface RequestContext {
		/** The platform's own configured sender address, before any per-tenant override. */
		platformSender: Address;
	}
}

/**
 * Creates the middleware publishing a fixed platform sender address.
 *
 * @param address - The platform's own configured sender address.
 * @returns The middleware, for the tenant router's global chain.
 * @example
 * createRouter({ middleware: [platformSender(parseSenderAddress(env.EMAIL_FROM))] });
 */
export function platformSender(address: Address): Middleware {
	return (ctx, next) => {
		ctx.set(PlatformSenderContext, address, { property: "platformSender" });
		return next();
	};
}
