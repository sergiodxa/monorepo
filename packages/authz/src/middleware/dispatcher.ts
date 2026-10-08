/**
 * The job dispatcher adapter: publishes `ctx.authz`, a binder carrying the
 * fact sources every job shares. A handler binds the subject from its own
 * payload, since a dispatcher middleware sees no typed input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobContext, JobMiddleware } from "@sdxc/jobs";
import type { Result } from "@sdxc/result";

import { createContextKey } from "remix/router";

import type { Access, AccessBinding } from "../access.js";
import type { AuthzError } from "../decision.js";
import type { FactLoader } from "../facts.js";
import type { FactDefinitions, FactValue } from "../grants.js";
import type { AnyPolicy, FactsOf, RegisteredPolicy } from "../policy.js";

import { isFactLoader } from "../facts.js";
import { recordDecision } from "../log.js";

/**
 * Binds a job's subject over the shared fact sources.
 *
 * @template F The policy's facts.
 */
export interface Authz<F extends FactDefinitions = FactDefinitions> {
	/**
	 * Binds roles and facts, the given facts replacing the shared ones by root.
	 *
	 * @param binding The subject's roles, ceiling and facts, read from the payload.
	 */
	for(binding: AccessBinding<F>): Result<Access<F>, AuthzError>;
}

/** The binder for the registered policy. */
export type RegisteredAuthz = Authz<FactsOf<RegisteredPolicy>>;

/**
 * The binder a delivery reads, by key. The type is written out because an
 * exported key needs a nameable type to reach a published declaration file.
 */
export const CurrentAuthz: { defaultValue?: RegisteredAuthz } = createContextKey<RegisteredAuthz>();

/** How the dispatcher adapter takes a fact: a value, a function of the job, or a loader. */
export type JobFactSource<T> = T | ((ctx: AnyJobContext) => T | Promise<T>) | FactLoader<T>;

/** What every job's binding shares. */
export interface AuthzOptions<P extends AnyPolicy = RegisteredPolicy> {
	facts?: { [K in keyof FactsOf<P>]?: JobFactSource<FactValue<FactsOf<P>[K]>> };
}

/**
 * Publishes `ctx.authz`, binding the policy with the shared fact sources.
 *
 * @param policy The app's policy.
 * @param options The fact sources every job shares.
 * @returns The middleware publishing `ctx.authz`.
 * @example authz(policy, { facts: { flags: fromFlags(features) } })
 */
export function authz<P extends AnyPolicy = RegisteredPolicy>(
	policy: P,
	options: AuthzOptions<P> = {},
): JobMiddleware<{ key: typeof CurrentAuthz; value: RegisteredAuthz; property: "authz" }> {
	return async (ctx, next) => {
		let shared: Record<string, unknown> = {};
		for (let [root, source] of Object.entries(options.facts ?? {})) {
			shared[root] =
				typeof source === "function" && !isFactLoader(source)
					? () => (source as (ctx: AnyJobContext) => unknown)(ctx)
					: source;
		}

		let binder: Authz = {
			for(binding) {
				return policy.for({
					onDecision: recordDecision,
					...binding,
					facts: { ...shared, ...binding.facts },
					context: ctx,
				});
			},
		};
		ctx.set(CurrentAuthz, binder as RegisteredAuthz, { property: "authz" });
		await next();
	};
}
