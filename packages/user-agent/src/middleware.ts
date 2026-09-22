/**
 * Router middleware that reads the request's `User-Agent` header once and
 * publishes the result as `ctx.userAgent`, so every handler and view in the
 * request branches on the same parsed shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

import type { UserAgent } from "./types.js";

import { parse } from "./parse.js";

/**
 * Declared in an imported module so the augmentation reaches every project that
 * installs the middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** What the request's `User-Agent` header describes. */
		userAgent: UserAgent;
	}
}

/**
 * What a surface reached before the middleware runs reads: every key the parser
 * produces, holding what an unrecognized string holds.
 */
const UNKNOWN: UserAgent = {
	browser: { name: null, version: null },
	engine: { name: null, version: null },
	os: { name: null, version: null },
	device: { type: null, vendor: null, model: null },
};

/**
 * The request's user agent, for a caller that reads it by key rather than
 * through the installed property. The type is written out because an exported
 * key needs a nameable type to reach a published declaration file.
 */
export const CurrentUserAgent: { defaultValue: UserAgent } = createContextKey<UserAgent>(UNKNOWN);

const USER_AGENT_PROPERTY = { property: "userAgent" } as const;

/**
 * Creates a middleware that reads the request's `User-Agent` header and exposes
 * it as `ctx.userAgent`; a request that sends no header reads as the shape an
 * unrecognized string produces.
 *
 * @returns A middleware that populates `ctx.userAgent`.
 * @example
 * let router = createRouter({ middleware: [userAgent()] });
 */
export function userAgent(): Middleware {
	return (ctx, next) => {
		let header = ctx.request.headers.get("user-agent") ?? "";
		ctx.set(CurrentUserAgent, parse(header), USER_AGENT_PROPERTY);
		return next();
	};
}
