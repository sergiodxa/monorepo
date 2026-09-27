/**
 * Ad-hoc ping endpoint: `POST /api/v1/ping`. Runs one HTTP, DNS, or TCP check against a
 * target described in the request body and returns what it observed, storing nothing and
 * dispatching no alert. Billed as one metered ping, so it requires an active subscription.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferOutput } from "@sdxc/json-schema";
import type { Adapter, RateLimiterBinding } from "@sdxc/rate-limit";
import type { Middleware } from "remix/router";

import { issuesFrom } from "@sdxc/problem";
import { CloudflareAdapter, MemoryAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid";
import { validate } from "@sdxc/validate";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import type { ContentCheckRule } from "~/app/data/content-check";
import type { DnsRecordType } from "~/app/lib/dns-record-value";
import type { PingStatus } from "~/app/services/analytics";

import Subscription from "~/app/data/subscription";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { PING_BODY } from "~/app/http/openapi/ping";
import { features } from "~/app/lib/flags";
import { recordAdhocPing } from "~/app/services/adhoc-ping";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apportionCostByTeam } from "~/app/services/cost";
import { checkDns } from "~/app/services/dns-check";
import { HttpCheck } from "~/app/services/http-check";
import { checkTcpConnection } from "~/app/services/tcp-check";
import { encodeId } from "~/app/services/typed-id";
import routes from "~/routes/web";

/**
 * Requests one API key may spend per {@link CALLER_WINDOW}; mirrors the `simple.limit` in
 * `wrangler.jsonc` for the `RATE_LIMITER` binding, kept in step by hand. This is an abuse
 * bound, not a product one — sixty a minute is far above any real pipeline's rate.
 */
const CALLER_LIMIT = 60;

/** Length of the caller budget's window; matches the binding's `simple.period` of 60. */
const CALLER_WINDOW = "1 minute";

/** Key namespace for the caller budget, kept stable so the counters survive a deploy. */
const CALLER_PREFIX = "api-ping";

type PingInput = InferOutput<typeof PING_BODY>;

/** One content check an HTTP ping carries, as the body spells it. */
type ContentCheckInput = Extract<PingInput, { type: "http" }>["contentChecks"][number];

/** What one ad-hoc ping observed, in the shape the response carries it. */
interface PingResult {
	status: PingStatus;
	responseTimeMs: number;
	/** Extra fields this ping type reports, merged into the response payload. */
	details: Record<string, unknown>;
}

/**
 * The `RATE_LIMITER` binding, when the running deployment declares one, checked
 * structurally on the raw environment so a deploy predating the `ratelimits` entry, or
 * a local runtime configured without it, keeps serving pings.
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
 * Backend counting the caller budget: without a binding it falls back to the isolate's
 * own memory, weaker but free, still bounding one connection's flood. `as const` keeps
 * the window a literal duration, which is what both adapters' options require.
 *
 * @returns The adapter to count with.
 */
function createAdapter(): Adapter {
	let options = { limit: CALLER_LIMIT, window: CALLER_WINDOW } as const;
	let binding = rateLimiterBinding();

	if (binding === undefined) return new MemoryAdapter(options);
	return new CloudflareAdapter(binding, options);
}

/**
 * The caller budget, built the first time a request needs it and reused after that,
 * since building it means reading the `RATE_LIMITER` binding off `env`.
 */
let limiter: Middleware | undefined;

/**
 * Spends one API key's budget before the handler runs, keyed on the key itself so the
 * budget follows it across however many CI runners share an egress address, or moves
 * with it when a runner is replaced. Runs after `requireApiKey`, which sets `ctx.apiKey`.
 */
const limitByApiKey: Middleware = (context, next) => {
	limiter ??= rateLimit({
		adapter: createAdapter(),
		prefix: CALLER_PREFIX,
		key: (ctx) => ctx.apiKey.id,
		/** The API's own `rate-limited` problem; the middleware adds `Retry-After` and the quota headers. */
		onLimit() {
			return apiProblems.rateLimited({
				detail: `More than ${CALLER_LIMIT} pings in a minute for this API key. Please try again later.`,
				instance: problemInstance(),
			});
		},
	});

	return limiter(context, next);
};

/** POST /api/v1/ping — runs one throwaway check and returns its result. */
export default createAction(routes.api.v1.ping, {
	middleware: [requireApiKey("ping:trigger"), limitByApiKey],
	handler: async (ctx) => {
		/**
		 * The endpoint's own switch, read before the body is: a team it is off for gets
		 * the same answer whatever it sent. The team is the subject, so a rule naming
		 * `team.slug` closes the endpoint to one caller rather than to every caller.
		 */
		let available = await ctx.flags.get(features.adhocPingApi, {
			context: { targetingKey: ctx.apiTeam.id, team: { slug: ctx.apiTeam.slug } },
		});

		if (!available) {
			return apiProblems.endpointUnavailable({
				detail: "Ad-hoc pings are unavailable",
				instance: problemInstance(),
			});
		}

		let parsed = await validate(ctx.request, PING_BODY);
		if (isFailure(parsed)) {
			return apiProblems.validationError({
				instance: problemInstance(),
				extensions: { errors: issuesFrom(parsed.error) },
			});
		}

		/**
		 * Reads via `stateFor`: an owner whose subscription state can't be determined fails
		 * open and gets their ping, matching what the manual "run check" button does —
		 * refusing a paying customer over an inconclusive lookup is the worse mistake.
		 */
		if ((await Subscription.stateFor(ctx.db, ctx.apiTeam.owner_id)) === "inactive") {
			return apiProblems.subscriptionRequired({
				detail: "An active subscription is required to run a ping",
				instance: problemInstance(),
			});
		}

		/**
		 * Everything this request costs belongs to the calling team — the probe's Durable
		 * Object time, the data point, the statements above (ADR-007 §5).
		 */
		apportionCostByTeam([ctx.apiTeam.id]);

		let input = parsed.data;
		let id = generateUUID();
		let result = await run(input);

		/** The data point keeps the canonical UUID; the TypeID is the wire format alone. */
		recordAdhocPing(ctx.billing, {
			id,
			team: ctx.apiTeam,
			status: result.status,
			responseTimeMs: result.responseTimeMs,
		});

		/**
		 * Always 200: whatever the target did is the answer the caller asked for, so status
		 * codes above are reserved for the request itself being malformed. Callers read the
		 * outcome from `data.ping.status`.
		 */
		return apiSuccess({
			ping: {
				id: encodeId("ping", id),
				type: input.type,
				status: result.status,
				responseTimeMs: result.responseTimeMs,
				checkedAt: new Date().toISOString(),
				...result.details,
			},
		});
	},
});

/** Runs the check the body asked for, through the same services the monitors use. */
async function run(input: PingInput): Promise<PingResult> {
	switch (input.type) {
		case "http":
			return await runHttp(input);
		case "dns":
			return await runDns(input);
		case "tcp":
			return await runTcp(input);
	}
}

async function runHttp(input: Extract<PingInput, { type: "http" }>): Promise<PingResult> {
	let check = new HttpCheck({
		url: input.url,
		method: input.method,
		headers: input.headers,
		body: input.body,
		expectedStatus: input.expectedStatus,
		degradedAfterMs: input.degradedAfterMs,
		timeoutSeconds: input.timeoutSeconds,
		locationHint: input.region,
		/**
		 * Sharded on the URL, which stays stable across calls, so a pipeline pinging the same
		 * target on every deploy keeps landing on the same warm Durable Object in its region.
		 */
		shardKey: input.url,
		contentChecks: input.contentChecks.map(toContentCheckRule),
	});

	let { outcome, contentChecksPassed, status } = await check.run();

	return {
		status,
		responseTimeMs: outcome.responseTimeMs ?? 0,
		details: { responseStatus: outcome.responseStatus, contentChecksPassed },
	};
}

async function runDns(input: Extract<PingInput, { type: "dns" }>): Promise<PingResult> {
	/**
	 * `previousValue` is null: an ad-hoc ping has no previous check to have changed from,
	 * so a `changed` status here only ever means the resolved value didn't match
	 * `expectedValue` — the one comparison a stateless caller can meaningfully ask for.
	 */
	let result = await checkDns(
		input.domain,
		input.recordType as DnsRecordType,
		input.expectedValue ?? null,
		null,
	);

	return {
		status: result.status,
		responseTimeMs: result.responseTimeMs,
		details: {
			resolvedValue: result.resolvedValue,
			errorMessage: result.errorMessage ?? null,
		},
	};
}

async function runTcp(input: Extract<PingInput, { type: "tcp" }>): Promise<PingResult> {
	let result = await checkTcpConnection(input.host, input.port, input.timeoutMs);

	return {
		status: result.status,
		responseTimeMs: result.responseTimeMs ?? 0,
		details: { errorMessage: result.errorMessage ?? null },
	};
}

/**
 * Turns a request-body content check into the rule the evaluator takes. `is_enabled` is
 * true by construction: a caller who wanted a rule skipped would simply not send it. A
 * toggle only matters for a check that outlives the request, as a stored one does.
 */
function toContentCheckRule(check: ContentCheckInput): ContentCheckRule {
	return {
		type: check.type,
		value: check.value,
		case_sensitive: check.caseSensitive,
		is_enabled: true,
	};
}
