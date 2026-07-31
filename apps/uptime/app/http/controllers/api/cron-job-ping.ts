/**
 * Public cron-job ping endpoint: `POST /api/v1/cron-jobs/:cronJobId/ping`. Unlike the
 * rest of the app, this route is intentionally unauthenticated — a scheduled job's
 * `curl` call is the entire integration, per `docs/cron-job-monitoring.md` ("the
 * system provides a unique ping endpoint"). The monitor's own id is the ping-URL
 * identifier; treat it as a bearer secret.
 *
 * Two independent limits apply, for two different reasons. The product rule is one
 * accepted ping per minute per monitor, enforced from `last_ping_at` in the handler
 * below. The abuse rule is a budget per caller, enforced by middleware before the
 * handler runs so a refused request never reaches the database — an unauthenticated
 * route is reachable in volume by anyone holding a ping URL, and the product rule
 * alone bounds what is *recorded*, not what is *charged*.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding } from "@pkg/rate-limit";
import type { Middleware } from "remix/fetch-router";

import { conflict, created, notFound, tooManyRequests } from "@pkg/http/response/json";
import { CloudflareAdapter, MemoryAdapter } from "@pkg/rate-limit";
import { rateLimit } from "@pkg/rate-limit/middleware";
import { getServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Resend } from "resend";

import CronJobMonitor from "~/app/data/cron-job";
import { notifyCronJobResult } from "~/app/services/alerts";
import routes from "~/routes/web";

/** Minimum time between accepted pings for a single monitor. */
const RATE_LIMIT_MS = 60_000;

/**
 * Requests one caller may spend on one monitor per {@link CALLER_WINDOW}, mirroring
 * the `simple.limit` declared for the `RATE_LIMITER` binding in `wrangler.jsonc`
 * (the binding reports neither, so the two are kept in step by hand and drift shows
 * up only in the response headers).
 *
 * Sixty is deliberately far above any legitimate use: {@link RATE_LIMIT_MS} already
 * caps useful throughput at one ping per minute per monitor, so this only has to
 * stop a flood, not shape traffic. A job that retries, runs on several replicas, or
 * has a skewed clock stays well inside it, while a caller hammering a ping URL is
 * cut from unbounded to one request per second.
 */
const CALLER_LIMIT = 60;

/** Length of the caller budget's window; matches the binding's `simple.period` of 60. */
const CALLER_WINDOW = "1 minute";

/** Key namespace for the caller budget, kept stable so the counters survive a deploy. */
const CALLER_PREFIX = "cron-ping";

/**
 * Stand-in for a key part the request did not supply, so those callers share one
 * bucket rather than escaping the limit by being unidentifiable.
 */
const UNKNOWN_BUCKET = "unknown";

/**
 * The `RATE_LIMITER` binding, when the running deployment declares one.
 *
 * It is read structurally rather than off the generated `Cloudflare.Env`, which is
 * what lets an absent binding be a supported state instead of a crash: a deploy
 * predating the `ratelimits` entry, or a local runtime configured without it, still
 * serves pings.
 *
 * @returns The binding, or `undefined` when this deployment has none.
 */
function rateLimiterBinding(): RateLimiterBinding | undefined {
	let candidate: unknown = (env as { RATE_LIMITER?: unknown }).RATE_LIMITER;
	if (typeof candidate !== "object" || candidate === null) return undefined;
	if (!("limit" in candidate) || typeof candidate.limit !== "function") return undefined;
	return candidate as RateLimiterBinding;
}

/**
 * Backend counting the caller budget.
 *
 * The binding is the only backend cheaper than the request it protects: it bills
 * nothing per call. KV is deliberately not the fallback — a read plus a write per
 * counted request costs several times the ping itself, so protecting the endpoint
 * that way would cost more than the abuse. Without the binding the count falls back
 * to the isolate's own memory, which is weaker (each isolate gets its own budget)
 * but free and still bounds a single connection's flood.
 *
 * @returns The adapter to count with.
 */
function createAdapter(): Adapter {
	let binding = rateLimiterBinding();
	// `as const` keeps the window a duration literal rather than widening it to `string`,
	// which is what both adapters' options accept.
	let options = { limit: CALLER_LIMIT, window: CALLER_WINDOW } as const;

	if (binding === undefined) return new MemoryAdapter(options);
	return new CloudflareAdapter(binding, options);
}

/**
 * The caller budget, built on the first request and reused by the isolate after
 * that: the adapter reads a binding off `env`, which is not module-scope work.
 */
let limiter: Middleware | undefined;

/**
 * Spends one caller's budget before the handler runs.
 *
 * The key is the calling address *and* the monitor being pinged. Both halves are
 * load-bearing: an address alone lets one noisy job behind a shared egress IP (a CI
 * provider, say) exhaust the budget of every other job behind it, and a monitor id
 * alone would let anyone spend that monitor's whole budget from anywhere. Only
 * `CF-Connecting-IP` is read — `X-Forwarded-For` is client-supplied, so keying on it
 * would let a caller mint a fresh bucket per request.
 */
const limitByCaller: Middleware = (context, next) => {
	limiter ??= rateLimit({
		adapter: createAdapter(),
		prefix: CALLER_PREFIX,
		key(ctx) {
			let params = s.parseSafe(s.object({ cronJobId: s.string() }), ctx.params);
			let monitor = params.success ? params.value.cronJobId : UNKNOWN_BUCKET;
			let address = ctx.request.headers.get("CF-Connecting-IP") ?? UNKNOWN_BUCKET;
			return `${address}:${monitor}`;
		},
	});

	return limiter(context, next);
};

/** POST /api/v1/cron-jobs/:cronJobId/ping */
export default createAction(routes.api.cronJobPing, {
	middleware: [limitByCaller],
	handler: async (ctx) => {
		let db = getServiceContainer().get(Database);

		let { cronJobId } = s.parse(s.object({ cronJobId: s.string() }), ctx.params);
		let monitor = await CronJobMonitor.findById(db, cronJobId);
		if (!monitor) return notFound({ error: "Not Found" });

		if (monitor.enabled_at === null) return conflict({ error: "Cron job is disabled" });

		if (monitor.last_ping_at !== null && Date.now() - monitor.last_ping_at < RATE_LIMIT_MS) {
			return tooManyRequests({ error: "Rate limit exceeded. Max 1 ping per minute." });
		}

		let deadline =
			monitor.next_expected_at === null
				? null
				: monitor.next_expected_at + monitor.grace_period_seconds * 1000;
		let wasOnTime = deadline === null || Date.now() <= deadline;

		await CronJobMonitor.recordPing(db, monitor, wasOnTime, {
			sourceIp:
				ctx.request.headers.get("CF-Connecting-IP") ?? ctx.request.headers.get("X-Forwarded-For"),
			userAgent: ctx.request.headers.get("User-Agent"),
		});

		let resend = getServiceContainer().get(Resend);
		await notifyCronJobResult(db, resend, monitor, monitor.status, wasOnTime ? "healthy" : "late");

		return created({ wasOnTime });
	},
});
