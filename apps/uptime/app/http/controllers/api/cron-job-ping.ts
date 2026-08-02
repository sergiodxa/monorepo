/**
 * Cron-job ping endpoint: `POST /api/v1/cron-jobs/:cronJobId/ping`. A scheduled job
 * reports that it ran by calling this; the monitor goes late or missed when it doesn't.
 *
 * It requires an API key carrying `cron-jobs:ping`, and it did not always. The endpoint
 * used to be deliberately open, with the monitor id in the URL serving as the secret —
 * the model most cron-monitoring services use, because it keeps the integration to a
 * bare `curl` with no header. The reason it changed is that a URL is a poor secret: it
 * leaks into CI logs, shell history, shared crontabs and screenshots, and once leaked
 * there was nothing to revoke short of deleting the monitor. A key can be scoped to this
 * one capability and rotated on its own.
 *
 * The cost of that is real and was accepted knowingly: every crontab pinging this
 * endpoint has to carry an `Authorization` header, and one that doesn't gets a 401 and
 * eventually a missed-check alert.
 *
 * Two independent limits apply, for two different reasons. The product rule is one
 * accepted ping per minute per monitor, enforced from `last_ping_at` in the handler
 * below. The abuse rule is a budget per caller, enforced by middleware *before*
 * authentication so that a flood is refused without spending a database read on looking
 * up whatever key it presented, and the product rule alone bounds what is *recorded*,
 * not what is *charged*.
 *
 * A ping this endpoint accepts is billed as one ping against the team's allowance, and
 * only an accepted one is: a request refused as unknown, disabled, or too frequent
 * performed no work, so it never reaches the ingestion below.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding } from "@pkg/rate-limit";
import type { Middleware } from "remix/fetch-router";

import { conflict, created, notFound, tooManyRequests } from "@pkg/http/response/json";
import { PolarClient } from "@pkg/polar";
import { CloudflareAdapter, MemoryAdapter } from "@pkg/rate-limit";
import { rateLimit } from "@pkg/rate-limit/middleware";
import { getServiceContainer } from "@pkg/service-container";
import { env, waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import Team from "~/app/data/team";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { notifyCronJobResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { ingestPings } from "~/app/services/ping-meter";
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
	middleware: [limitByCaller, requireApiKey("cron-jobs:ping")],
	handler: async (ctx) => {
		let db = getServiceContainer().get(Database);

		let { cronJobId } = s.parse(s.object({ cronJobId: s.string() }), ctx.params);
		/**
		 * Scoped to the key's own team, not looked up by id alone. Authenticating the caller
		 * only says who they are; without this a key from any team could ping any monitor
		 * whose id it had, which is the same hole the id-as-secret model had, reopened one
		 * step later.
		 *
		 * A monitor belonging to someone else answers 404 rather than 403, so the endpoint
		 * cannot be used to discover which ids exist.
		 */
		let monitor = await CronJobMonitor.findByIdForTeam(db, ctx.apiTeam.id, cronJobId);
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

		let pingId = await CronJobMonitor.recordPing(db, monitor, wasOnTime, {
			sourceIp:
				ctx.request.headers.get("CF-Connecting-IP") ?? ctx.request.headers.get("X-Forwarded-For"),
			userAgent: ctx.request.headers.get("User-Agent"),
		});

		/**
		 * A cron ping is a report, not a measurement: it carries no latency of its own — the
		 * job already ran, elsewhere — and the only thing observed about it is whether it
		 * arrived by its deadline. So on time is `up`, late is `degraded`, and the response
		 * time is zero rather than a number nothing measured. A job that never pings at all
		 * produces no row here; the scheduled sweep is what notices that silence.
		 */
		writePingResult({
			monitorId: monitor.id,
			teamId: monitor.team_id,
			type: "cron",
			status: wasOnTime ? "up" : "degraded",
			responseTimeMs: 0,
		});

		let ownerIds = await Team.ownerIdsByTeamIds(db, [monitor.team_id]);
		let ownerId = ownerIds.get(monitor.team_id);
		if (ownerId === undefined) {
			/**
			 * No owner means no Polar customer to ingest against. The ping is still recorded
			 * and still answered — a billing gap must not turn a caller's healthy job into a
			 * failed `curl` — so this only leaves a trace.
			 */
			ctx.logger.error("api.cron_job_ping.unbillable_team", {
				monitorId: monitor.id,
				teamId: monitor.team_id,
			});
		} else {
			/**
			 * Deferred rather than awaited, unlike the queue sweeps: those already run
			 * outside a request and their wall time costs nobody a wait, while this one is
			 * on the response path of a caller whose job is blocked on it. Ingestion is
			 * best-effort either way, so the round trip belongs after the response.
			 */
			waitUntil(
				ingestPings(getServiceContainer().get(PolarClient), [
					{
						externalId: `ping:${pingId}`,
						ownerId,
						teamId: monitor.team_id,
						monitorId: monitor.id,
						type: "cron",
					},
				]),
			);
		}

		await notifyCronJobResult(
			db,
			ctx.email,
			monitor,
			monitor.status,
			wasOnTime ? "healthy" : "late",
		);

		return created({ wasOnTime });
	},
});
