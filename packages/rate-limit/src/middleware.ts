/**
 * Remix fetch-router middleware that spends a request's rate limit budget before
 * the handler runs and annotates the response with the quota it saw. Registering
 * it is the whole policy, so a new route cannot forget to check a limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { tooManyRequests } from "@sdxc/http/response/json";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import type { Adapter, RateLimitDecision } from "./types.js";

import { applyRateLimitHeaders } from "./headers.js";

/** Error code in the default limited response body. */
const LIMITED_ERROR = "too_many_requests";

/** Human-readable description in the default limited response body. */
const LIMITED_DESCRIPTION = "Rate limit exceeded. Please try again later.";

/** Key used when no client address is available, so limiting still applies. */
const UNKNOWN_KEY = "unknown";

/** Warning recorded when an attempt is denied: expected traffic, kept visible. */
const EXCEEDED_EVENT = "rate_limit.exceeded";

/** Recorded when the backend could not answer: a warning when traffic flowed, a failure when it was refused. */
const UNAVAILABLE_EVENT = "rate_limit.unavailable";

/** Registrations so far, used to give each limiter its own key namespace. */
let registrations = 0;

/**
 * What happens when the backend cannot answer. `"open"` lets the request through
 * so a storage outage cannot lock every client out; `"closed"` rejects it, for a
 * surface where an uncounted request is worse than a refused one.
 */
export type FailurePolicy = "open" | "closed";

/** Options that configure one rate limit registration. */
export interface RateLimitMiddlewareOptions {
	/** Backend that counts the attempts and owns the policy. */
	adapter: Adapter;
	/**
	 * Identifier to limit on, e.g. a client id, token id, or tenant id. Defaults to
	 * the client IP address, falling back to a shared `"unknown"` bucket when the
	 * request carries no client address.
	 */
	key?: (context: RequestContext) => string | Promise<string>;
	/**
	 * Namespace for this registration's keys, so two limiters over one backend
	 * cannot share a counter; defaults to a per-registration name. Pass an explicit
	 * prefix when keys are persisted or inspected, so they stay stable across deploys.
	 */
	prefix?: string;
	/** Budget units one request spends, or a function computing them. Defaults to 1. */
	cost?: number | ((context: RequestContext) => number | Promise<number>);
	/**
	 * Requests to let through without counting, e.g. an internal health check or a
	 * request already authenticated as an admin.
	 */
	skip?: (context: RequestContext) => boolean | Promise<boolean>;
	/**
	 * Response for a denied request, replacing the default JSON body — an HTML page,
	 * for example. Rate limit headers are added to whatever it returns.
	 */
	onLimit?: (context: RequestContext, decision: RateLimitDecision) => Response | Promise<Response>;
	/** What to do when the backend cannot answer. Defaults to `"open"`. */
	failurePolicy?: FailurePolicy;
}

/**
 * Creates a middleware that limits every request in its scope. It spends the
 * budget before `next()`, so a denial never reaches the handler, and reports
 * the decision on every response and on the invocation's log, keeping
 * registrations' keys independent. The limited key stays out of the log, since
 * it may carry a token or client identifier.
 *
 * @param options - Adapter, key derivation, and policy; see {@link RateLimitMiddlewareOptions}.
 * @returns A middleware that counts the request and annotates the response.
 * @example
 * router.use(rateLimit({ adapter: new MemoryAdapter({ limit: 10, window: "10 seconds" }) }));
 * @example
 * router.use(rateLimit({ adapter, prefix: "token", key: (context) => context.get(ClientId) }));
 */
export function rateLimit(options: RateLimitMiddlewareOptions): Middleware {
	let adapter = options.adapter;
	let failurePolicy = options.failurePolicy ?? "open";
	registrations += 1;
	let prefix = options.prefix ?? `limiter-${registrations}`;

	return async (context, next) => {
		if (options.skip !== undefined && (await options.skip(context))) return next();

		let key = `${prefix}:${await resolveKey(context, options.key)}`;
		let result = await adapter.consume(key, await resolveCost(context, options.cost));
		let log = currentLog();

		if (isFailure(result)) {
			let detail = { policy: failurePolicy, backend: result.error.backend };
			if (failurePolicy === "open") {
				log?.warn(UNAVAILABLE_EVENT, { ...detail, error: result.error.message });
				return next();
			}
			log?.fail(result.error, { rate_limit: detail });
			return limitedResponse();
		}

		let decision = result.data;
		log?.set({ rate_limit: { limit: decision.limit, remaining: decision.remaining } });

		if (!decision.allowed) {
			log?.set({ rate_limit: { limited: true } });
			log?.warn(EXCEEDED_EVENT, { limit: decision.limit, retry_after_s: decision.retryAfter });
			let response = options.onLimit ? await options.onLimit(context, decision) : limitedResponse();
			return applyRateLimitHeaders(response, decision, adapter.window);
		}

		return applyRateLimitHeaders(await next(), decision, adapter.window);
	};
}

/**
 * Derives the identifier to limit on, defaulting to the client address.
 *
 * @param context - The request context.
 * @param key - The configured derivation, when there is one.
 * @returns The unprefixed key.
 */
async function resolveKey(
	context: RequestContext,
	key: RateLimitMiddlewareOptions["key"],
): Promise<string> {
	if (key === undefined) return getClientIP(context.request) ?? UNKNOWN_KEY;
	return await key(context);
}

/**
 * Resolves how many budget units the request spends.
 *
 * @param context - The request context.
 * @param cost - The configured cost, when there is one.
 * @returns The cost, or `undefined` to let the adapter apply its default.
 */
async function resolveCost(
	context: RequestContext,
	cost: RateLimitMiddlewareOptions["cost"],
): Promise<number | undefined> {
	if (cost === undefined) return undefined;
	if (typeof cost === "number") return cost;
	return await cost(context);
}

/**
 * The default response for a denied request: `429` with the OAuth-style error body
 * the protected endpoints already return, so adopting the middleware does not
 * change an existing client contract.
 *
 * @returns A `429 Too Many Requests` JSON response.
 */
function limitedResponse(): Response {
	return tooManyRequests({ error: LIMITED_ERROR, error_description: LIMITED_DESCRIPTION });
}
