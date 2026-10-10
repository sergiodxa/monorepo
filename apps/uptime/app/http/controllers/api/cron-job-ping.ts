/**
 * Cron-job ping endpoint: `POST /api/v1/cron-jobs/:cronJobId/ping`. A scheduled
 * job reports that it ran by calling this; the monitor goes late or missed
 * when it doesn't. Callers authenticate with an API key scoped to
 * `cron-jobs:ping`; a per-monitor rate limit and a per-caller abuse budget
 * apply independently, and only an accepted ping is billed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding } from "@sdxc/rate-limit";
import type { Middleware } from "remix/router";

import { created } from "@sdxc/http/response/json";
import * as s from "@sdxc/json-schema";
import { CloudflareAdapter, MemoryAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { env, waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";

import requireApiKey from "~/app/http/middleware/require-api-key";
import { CRON_JOB_PING_PARAMS } from "~/app/http/openapi/cron-jobs";
import { notifyCronJobResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { ingestPings } from "~/app/services/ping-meter";
import { decodeIdOrUUID } from "~/app/services/typed-id";
import routes from "~/routes/web";

/**
 * Minimum time between accepted pings for a single monitor: half a minute
 * rather than a full one, since queue latency and dispatch jitter put a
 * job's consecutive pings a second or two either side of the schedule.
 */
const RATE_LIMIT_MS = 30_000;

/**
 * Requests one caller may spend on one monitor per {@link CALLER_WINDOW},
 * mirroring the `RATE_LIMITER` binding's `simple.limit`. Set well above
 * legitimate use, since {@link RATE_LIMIT_MS} already caps useful throughput.
 */
const CALLER_LIMIT = 60;

/** Length of the caller budget's window; matches the binding's `simple.period` of 60. */
const CALLER_WINDOW = "1 minute";

/** Key namespace for the caller budget, kept stable so the counters survive a deploy. */
const CALLER_PREFIX = "cron-ping";

/**
 * Stand-in for a missing key part, so unidentified callers share one bucket
 * and count against the same limit.
 */
const UNKNOWN_BUCKET = "unknown";

/**
 * The `RATE_LIMITER` binding, when the running deployment declares one. Read
 * structurally rather than off the generated `Cloudflare.Env`, so a deploy
 * predating the `ratelimits` entry still serves pings instead of crashing.
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
 * Backend counting the caller budget: the binding costs nothing per call,
 * cheaper than KV's read-plus-write, which would cost more than the abuse it
 * prevents. Falls back to the isolate's own memory without a binding.
 *
 * @returns The adapter to count with.
 */
function createAdapter(): Adapter {
	let binding = rateLimiterBinding();
	/** `as const` keeps `window` typed as the literal duration the adapters expect. */
	let options = { limit: CALLER_LIMIT, window: CALLER_WINDOW } as const;

	if (binding === undefined) return new MemoryAdapter(options);
	return new CloudflareAdapter(binding, options);
}

/**
 * The caller budget, built on the first request and reused by the isolate
 * after that, since the adapter can only read a binding off `env` once
 * request-scoped code is running.
 */
let limiter: Middleware | undefined;

/**
 * Spends one caller's budget before the handler runs, keyed on the calling
 * address plus the monitor being pinged, so neither a shared egress IP nor a
 * bare monitor id lets one caller exhaust another's budget.
 */
const limitByCaller: Middleware = (context, next) => {
	limiter ??= rateLimit({
		adapter: createAdapter(),
		prefix: CALLER_PREFIX,
		key(ctx) {
			let params = s.parseSafe(CRON_JOB_PING_PARAMS, ctx.params);
			/**
			 * Both spellings of an id resolve to the UUID before it becomes a bucket, so
			 * alternating between them spends one budget rather than two.
			 */
			let monitor =
				(params.success ? decodeIdOrUUID("cron", params.value.cronJobId) : null) ?? UNKNOWN_BUCKET;
			/**
			 * An IPv6 caller is keyed on its /64, the block one subscriber holds, so cycling
			 * through the addresses it was assigned spends the one budget.
			 */
			let address = ctx.ip?.network({ v4: 32, v6: 64 }).toString() ?? UNKNOWN_BUCKET;
			return `${address}:${monitor}`;
		},
		/** The API's own `rate-limited` problem; the middleware adds `Retry-After` and the quota headers. */
		onLimit() {
			return apiProblems.rateLimited({
				detail: "Too many pings from this caller. Please try again later.",
				instance: problemInstance(),
			});
		},
	});

	return limiter(context, next);
};

/** POST /api/v1/cron-jobs/:cronJobId/ping */
export default createAction(routes.api.cronJobPing, {
	middleware: [limitByCaller, requireApiKey("cron-jobs:ping")],
	handler: async (ctx) => {
		let params = s.parse(CRON_JOB_PING_PARAMS, ctx.params);
		/**
		 * The API hands out `cron_…`, and a crontab written against the older raw UUID
		 * still names the same monitor, so both reach it. An id in neither form answers
		 * 404 along with every other id this team cannot ping.
		 */
		let cronJobId = decodeIdOrUUID("cron", params.cronJobId);
		if (cronJobId === null)
			return apiProblems.notFound({ detail: "Cron job not found", instance: problemInstance() });

		/**
		 * Scoped to the key's own team: authentication alone says who the caller is,
		 * not which monitors they may ping. A monitor belonging to someone else
		 * answers 404 rather than 403, so ids can't be discovered by probing.
		 */
		let monitor = await ctx.models.cronJobMonitors.inTeam(ctx.apiTeam.id).find(cronJobId);
		if (!monitor)
			return apiProblems.notFound({ detail: "Cron job not found", instance: problemInstance() });

		ctx.log.set({ monitor: { id: monitor.id, type: "cron" } });

		if (monitor.enabled_at === null)
			return apiProblems.conflict({ detail: "Cron job is disabled", instance: problemInstance() });

		if (monitor.last_ping_at !== null && Date.now() - monitor.last_ping_at < RATE_LIMIT_MS) {
			let retryAfter = Math.ceil((RATE_LIMIT_MS - (Date.now() - monitor.last_ping_at)) / 1000);
			return apiProblems.rateLimited(
				{
					detail: "Rate limit exceeded. Max 1 ping every 30 seconds.",
					instance: problemInstance(),
				},
				{ headers: { "Retry-After": String(retryAfter) } },
			);
		}

		let deadline =
			monitor.next_expected_at === null
				? null
				: monitor.next_expected_at + monitor.grace_period_seconds * 1000;
		let wasOnTime = deadline === null || Date.now() <= deadline;

		/**
		 * The recorded source is the address Cloudflare saw connect, so a caller can
		 * never write an address of its choosing into the ping history.
		 */
		let pingId = await ctx.models.cronJobMonitors.recordPing(monitor, wasOnTime, {
			sourceIp: ctx.ip?.toString() ?? null,
			userAgent: ctx.request.headers.get("User-Agent"),
		});

		/**
		 * A cron ping reports that the job already ran elsewhere: arrival against
		 * its deadline is what's observed, so on time is `up`, late is `degraded`,
		 * and response time is recorded as a flat zero.
		 */
		writePingResult({
			monitorId: monitor.id,
			teamId: monitor.team_id,
			type: "cron",
			status: wasOnTime ? "up" : "degraded",
			responseTimeMs: 0,
		});

		let ownerIds = await ctx.models.teams.ownerIdsByTeamIds([monitor.team_id]);
		let ownerId = ownerIds.get(monitor.team_id);
		if (ownerId === undefined) {
			/**
			 * No owner means no Polar customer to ingest against. The ping is still recorded
			 * and still answered — a billing gap must not turn a caller's healthy job into a
			 * failed `curl` — so this only leaves a trace.
			 */
			ctx.log.warn("team.unbillable");
		} else {
			/**
			 * Deferred past the response, since this call sits on the path of a caller
			 * whose job is blocked waiting for it, and ingestion is best-effort, so its
			 * round trip belongs after the caller is already answered.
			 */
			waitUntil(
				ingestPings(ctx.billing, [
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
			ctx.models,
			ctx.email,
			monitor,
			monitor.status,
			wasOnTime ? "healthy" : "late",
		);

		return created({ wasOnTime });
	},
});
