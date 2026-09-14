/**
 * The middleware a job dispatcher installs to publish a job-scoped client as
 * `ctx.flags`, carried by the middleware's declared effect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobContext, JobMiddleware } from "@sdxc/jobs";

import type { Flags as FlagsRegistry } from "../client/registry.js";
import type { Client } from "../core/client.js";
import type { EvaluationContext } from "../core/context.js";
import type { MaybePromise } from "../core/value.js";

import { Flags } from "./index.js";

/** What one installation of the dispatcher middleware settles. */
export interface FeatureFlagsOptions {
	/**
	 * Reads the subject and whatever else targeting is written against off the
	 * job's context, as the client-level context every evaluation of this
	 * delivery merges. Omitted, evaluations see the global context and their own.
	 */
	context?: (ctx: AnyJobContext) => MaybePromise<EvaluationContext>;
	/** Evaluates through the provider bound to this domain instead of the default one. */
	domain?: string;
}

/**
 * Publishes the delivery's client as `ctx.flags`, typed on the handler through
 * the effect the dispatcher folds out of its chain.
 *
 * The registry's providers are initialized on the first delivery an isolate
 * runs and reused by every one after it, so the per-delivery cost is the
 * `context` callback and nothing else.
 *
 * @param flags The application's API instance, built once at module scope.
 * @param options Where the delivery's targeting context comes from, and which domain to bind.
 * @returns The middleware installing the client as `ctx.flags`.
 * @example
 * createJobDispatcher({
 * 	middleware: [featureFlags(flags, { context: (ctx) => ({ targetingKey: ctx.get(Team).id }) })],
 * });
 */
export default function featureFlags(
	flags: FlagsRegistry,
	options: FeatureFlagsOptions = {},
): JobMiddleware<{ key: typeof Flags; value: Client; property: "flags" }> {
	return async (ctx, next) => {
		await flags.ready();

		let context = await options.context?.(ctx);

		ctx.set(Flags, flags.getClient(options.domain, context), { property: "flags" });

		await next();
	};
}
