/**
 * Router middleware that parses the client's address once per request and
 * publishes it as `ctx.ip`, so handlers and later middleware read an `IP`
 * without touching headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IP } from "@sdxc/ip";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

import { getClientIP as readClientIP } from "./index.js";

/**
 * Declared in an imported module so the augmentation reaches every project that
 * installs the middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** The client's address from `CF-Connecting-IP`, or `null` when absent or malformed. */
		ip: IP | null;
	}
}

/**
 * The client's address, for a caller that reads it by key rather than through
 * the installed property; a context the middleware never ran on reads `null`.
 * The type is written out because an exported key needs a nameable type to
 * reach a published declaration file.
 */
export const ClientIP: { defaultValue: IP | null } = createContextKey<IP | null>(null);

const IP_PROPERTY = { property: "ip" } as const;

/**
 * Creates a middleware that parses `CF-Connecting-IP` and exposes the result as
 * `ctx.ip`.
 *
 * @returns A middleware that populates `ctx.ip`.
 * @example
 * let router = createRouter({ middleware: [log(logger), getClientIP()] });
 */
export default function getClientIP(): Middleware {
	return (ctx, next) => {
		ctx.set(ClientIP, readClientIP(ctx.request), IP_PROPERTY);
		return next();
	};
}
