/**
 * Remix fetch-router middleware that spends a request's rate limit budget before
 * the handler runs and annotates the response with the quota it saw. Registering
 * it is the whole policy, so a new route cannot forget to check a limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { getClientIP } from "@pkg/get-client-ip";
import { tooManyRequests } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";

import type { RateLimitError } from "./rate-limit-error";
import type { Adapter, RateLimitDecision } from "./types";

import { applyRateLimitHeaders } from "./headers";

/** Error code in the default limited response body. */
const LIMITED_ERROR = "too_many_requests";

/** Human-readable description in the default limited response body. */
const LIMITED_DESCRIPTION = "Rate limit exceeded. Please try again later.";

/** Key used when no client address is available, so limiting still applies. */
const UNKNOWN_KEY = "unknown";

/** Logged when an attempt is denied, at info level: this is normal traffic. */
const EXCEEDED_EVENT = "rate_limit.exceeded";

/** Logged when the backend could not answer, at error level: this needs attention. */
const UNAVAILABLE_EVENT = "rate_limit.unavailable";

/** Registrations so far, used to give each limiter its own key namespace. */
let registrations = 0;

/**
 * What happens when the backend cannot answer. `"open"` lets the request through
 * so a storage outage cannot lock every client out; `"closed"` rejects it, for a
 * surface where an uncounted request is worse than a refused one.
 */
export type FailurePolicy = "open" | "closed";

/**
 * The part of a logger this middleware needs. It is structural so the package
 * reports through whichever logger an app installed on the context, without
 * depending on a logging library itself.
 */
export interface RateLimitLogger {
	/**
	 * Records a routine event, such as a denied attempt.
	 *
	 * @param event - Event name, e.g. `rate_limit.exceeded`.
	 * @param payload - Structured details about the event.
	 */
	info(event: string, payload?: Record<string, unknown>): void;
	/**
	 * Records a failure event, such as an unreachable backend.
	 *
	 * @param event - Event name, e.g. `rate_limit.unavailable`.
	 * @param payload - Structured details about the failure.
	 */
	error(event: string, payload?: Record<string, unknown>): void;
}

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
	/**
	 * Resolves the logger for denied attempts and backend failures. Defaults to
	 * `context.logger` when the app installed one.
	 */
	logger?: (context: RequestContext) => RateLimitLogger | undefined;
}

/**
 * Creates a middleware that limits every request in its scope. It spends the
 * budget before `next()`, so a denial never reaches the handler, and reports
 * the decision on every response, keeping registrations' keys independent.
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
		let logger = options.logger?.(context) ?? contextLogger(context);

		if (isFailure(result)) {
			logger?.error(UNAVAILABLE_EVENT, failurePayload(key, failurePolicy, result.error));
			if (failurePolicy === "open") return next();
			return limitedResponse();
		}

		let decision = result.data;

		if (!decision.allowed) {
			logger?.info(EXCEEDED_EVENT, { key, limit: decision.limit, retryAfter: decision.retryAfter });
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
 * The log payload for an unreachable backend, naming the policy that was applied so
 * the log says whether traffic was let through.
 *
 * @param key - The prefixed key that could not be counted.
 * @param policy - The failure policy in force.
 * @param error - The failure the adapter reported.
 * @returns Structured details for the log entry.
 */
function failurePayload(
	key: string,
	policy: FailurePolicy,
	error: RateLimitError,
): Record<string, unknown> {
	return { key, policy, backend: error.backend, error: error.message };
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

/** Reads a logger off the request context, accepting anything that can record both levels. */
function contextLogger(context: RequestContext): RateLimitLogger | undefined {
	let candidate: unknown = (context as { logger?: unknown }).logger;
	if (typeof candidate !== "object" || candidate === null) return undefined;
	if (!("info" in candidate) || typeof candidate.info !== "function") return undefined;
	if (!("error" in candidate) || typeof candidate.error !== "function") return undefined;
	return candidate as RateLimitLogger;
}
