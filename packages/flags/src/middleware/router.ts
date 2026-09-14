/**
 * The middleware a `remix/router` fetch router installs to publish a
 * request-scoped client as `ctx.flags`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import type { Flags as FlagsRegistry } from "../client/registry.js";
import type { Client } from "../core/client.js";
import type { EvaluationContext } from "../core/context.js";
import type { MaybePromise } from "../core/value.js";

import { Flags } from "./index.js";

/**
 * Declared in an imported module rather than an ambient declaration, so a
 * project types `ctx.flags` by importing this middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** The client this request evaluates through, carrying the context the middleware built. */
		flags: Client;
	}
}

const FLAGS_PROPERTY = { property: "flags" } as const;

/** What one installation of the router middleware settles. */
export interface FeatureFlagsOptions {
	/**
	 * Reads the subject and whatever else targeting is written against off the
	 * request, as the client-level context every evaluation of this request
	 * merges. Omitted, evaluations see the global context and their own.
	 */
	context?: (ctx: RequestContext) => MaybePromise<EvaluationContext>;
	/** Evaluates through the provider bound to this domain instead of the default one. */
	domain?: string;
}

/**
 * Publishes the request's client as `ctx.flags`.
 *
 * The registry's providers are initialized on the first request an isolate
 * serves and reused by every request after it, so the per-request cost is the
 * `context` callback and nothing else.
 *
 * @param flags The application's API instance, built once at module scope.
 * @param options Where the request's targeting context comes from, and which domain to bind.
 * @returns The middleware installing the client as `ctx.flags`.
 * @example
 * createRouter({
 * 	middleware: [
 * 		featureFlags(flags, {
 * 			context(ctx) {
 * 				return { targetingKey: ctx.session.get("userId") };
 * 			},
 * 		}),
 * 	],
 * });
 */
export default function featureFlags(
	flags: FlagsRegistry,
	options: FeatureFlagsOptions = {},
): Middleware<{ key: typeof Flags; value: Client; property: "flags" }> {
	return async (ctx, next) => {
		await flags.ready();

		let context = await options.context?.(ctx);

		ctx.set(Flags, flags.getClient(options.domain, context), FLAGS_PROPERTY);

		return next();
	};
}
