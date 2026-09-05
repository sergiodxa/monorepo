/**
 * Ad-hoc ping endpoint: `POST /api/v1/ping`. Runs one HTTP, DNS, or TCP check against a
 * target described in the request body and returns what it observed, storing nothing and
 * dispatching no alert. Billed as one metered ping, so it requires an active subscription.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding } from "@sdxc/rate-limit";
import type { Middleware } from "remix/router";

import { BadRequest, PaymentRequired } from "@sdxc/http/status-code";
import { CloudflareAdapter, MemoryAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { generateUUID } from "@sdxc/uuid";
import { validate } from "@sdxc/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";

import type { ContentCheckRule } from "~/app/data/content-check";
import type { DnsRecordType } from "~/app/lib/dns-record-value";
import type { PingStatus } from "~/app/services/analytics";

import Subscription from "~/app/data/subscription";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { DNS_RECORD_TYPES } from "~/app/lib/dns-record-value";
import { recordAdhocPing } from "~/app/services/adhoc-ping";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { apportionCostByTeam } from "~/app/services/cost";
import { checkDns } from "~/app/services/dns-check";
import { HttpCheck } from "~/app/services/http-check";
import { checkTcpConnection } from "~/app/services/tcp-check";
import { encodeId } from "~/app/services/typed-id";
import routes from "~/routes/web";

/**
 * Regions a ping may be probed from, matching the `location_hint` column HTTP monitors
 * carry so an ad-hoc check and a monitored one measure the same thing from the same place.
 */
const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

/** Methods a ping may use, matching what an HTTP monitor may be configured with. */
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;

/** The subset of {@link HTTP_METHODS} the platform refuses to attach a request body to. */
const BODYLESS_METHODS: readonly string[] = ["GET", "HEAD"];

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

/** One content-check rule as the request body spells it, before it becomes a rule. */
const ContentCheckSchema = s.object({
	type: s.enum_(["contains", "not_contains", "regex"]),
	value: s.string().pipe(checks.minLength(1), checks.maxLength(1000)),
	caseSensitive: s.defaulted(s.boolean(), false),
});

/**
 * The request body, discriminated on `type` with bounds mirroring the monitor
 * validators. Discriminators pass their literal type explicitly, since letting it
 * infer would widen `"http"` to `string` and leave {@link run} nothing to narrow on.
 */
const PingSchema = s.variant("type", {
	http: s
		.object({
			type: s.literal<"http">("http"),
			url: s.string().pipe(checks.url()),
			method: s.defaulted(s.enum_(HTTP_METHODS), "GET"),
			expectedStatus: s.defaulted(s.number().pipe(checks.min(100), checks.max(599)), 200),
			timeoutSeconds: s.defaulted(s.number().pipe(checks.min(1), checks.max(60)), 10),
			degradedAfterMs: s.defaulted(s.number().pipe(checks.min(1), checks.max(60_000)), 5000),
			region: s.defaulted(s.enum_(LOCATION_HINTS), "wnam"),
			headers: s.optional(s.record(s.string(), s.string())),
			body: s.optional(s.string().pipe(checks.maxLength(10_000))),
			contentChecks: s.defaulted(s.array(ContentCheckSchema), []),
		})
		/**
		 * Constructing a GET or HEAD request with a body throws a `TypeError` indistinguishable
		 * from the Durable Object being unavailable; catching it here turns it into a normal
		 * validation error on this, the only cross-field rule the body has.
		 */
		.refine(
			(value) => value.body === undefined || !BODYLESS_METHODS.includes(value.method),
			"A body cannot be sent with a GET or HEAD ping",
		),
	dns: s.object({
		type: s.literal<"dns">("dns"),
		domain: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
		recordType: s.defaulted(s.enum_(DNS_RECORD_TYPES), "A"),
		expectedValue: s.optional(s.string().pipe(checks.maxLength(1000))),
	}),
	tcp: s.object({
		type: s.literal<"tcp">("tcp"),
		host: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
		port: s.number().pipe(checks.min(1), checks.max(65_535)),
		timeoutMs: s.defaulted(s.number().pipe(checks.min(100), checks.max(60_000)), 5000),
	}),
});

type PingInput = s.InferOutput<typeof PingSchema>;

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
	});

	return limiter(context, next);
};

/** POST /api/v1/ping — runs one throwaway check and returns its result. */
export default createAction(routes.api.v1.ping, {
	middleware: [requireApiKey("ping:trigger"), limitByApiKey],
	handler: async (ctx) => {
		let parsed = await validate(ctx.request, PingSchema);
		if (isFailure(parsed)) {
			return apiError(
				"VALIDATION_ERROR",
				parsed.error.issues.map((issue) => issue.message).join(", "),
				BadRequest,
			);
		}

		let db = getServiceContainer().get(Database);

		/**
		 * Reads via `stateFor`: an owner whose subscription state can't be determined fails
		 * open and gets their ping, matching what the manual "run check" button does —
		 * refusing a paying customer over an inconclusive lookup is the worse mistake.
		 */
		if ((await Subscription.stateFor(db, ctx.apiTeam.owner_id)) === "inactive") {
			return apiError(
				"SUBSCRIPTION_REQUIRED",
				"An active subscription is required to run a ping",
				PaymentRequired,
			);
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
function toContentCheckRule(check: s.InferOutput<typeof ContentCheckSchema>): ContentCheckRule {
	return {
		type: check.type,
		value: check.value,
		case_sensitive: check.caseSensitive,
		is_enabled: true,
	};
}
