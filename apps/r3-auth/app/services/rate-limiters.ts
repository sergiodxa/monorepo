/**
 * The five rate limiters protecting the OAuth, authorization and login surfaces, each
 * wrapping the Cloudflare binding declared for it together with that binding's limit
 * and window. Grouped into one service so the container hands out a single value and
 * every endpoint spends from the budget meant for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CloudflareAdapterOptions } from "@pkg/rate-limit";

import { CloudflareAdapter } from "@pkg/rate-limit";

/**
 * Limit and window of every binding, mirroring the `simple: { limit, period }`
 * blocks in `wrangler.jsonc`. The platform never reports these values back, so
 * drift here silently makes every `RateLimit` response header wrong.
 */
const POLICIES = {
	token: { limit: 20, window: "1 minute" },
	introspect: { limit: 100, window: "1 minute" },
	revoke: { limit: 50, window: "1 minute" },
	authorize: { limit: 30, window: "1 minute" },
	login: { limit: 10, window: "1 minute" },
} as const satisfies Record<string, CloudflareAdapterOptions>;

/** The bindings each limiter counts against, one per protected surface. */
export interface RateLimiterBindings {
	token: RateLimit;
	introspect: RateLimit;
	revoke: RateLimit;
	authorize: RateLimit;
	login: RateLimit;
}

export default class RateLimiters {
	/** Token endpoint: keyed on the client id for client credentials, on the IP otherwise. */
	readonly token: CloudflareAdapter;
	/** Introspection endpoint, the highest budget of the five because clients poll it. */
	readonly introspect: CloudflareAdapter;
	/** Revocation endpoint. */
	readonly revoke: CloudflareAdapter;
	/** Authorization endpoint, keyed on the client IP. */
	readonly authorize: CloudflareAdapter;
	/** Interactive and provider login, the strictest budget: it guards password attempts. */
	readonly login: CloudflareAdapter;

	/**
	 * Wraps each binding in an adapter carrying its declared policy.
	 * @param bindings - The worker's five rate limiter bindings.
	 */
	constructor(bindings: RateLimiterBindings) {
		this.token = new CloudflareAdapter(bindings.token, POLICIES.token);
		this.introspect = new CloudflareAdapter(bindings.introspect, POLICIES.introspect);
		this.revoke = new CloudflareAdapter(bindings.revoke, POLICIES.revoke);
		this.authorize = new CloudflareAdapter(bindings.authorize, POLICIES.authorize);
		this.login = new CloudflareAdapter(bindings.login, POLICIES.login);
	}
}
