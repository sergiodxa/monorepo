/**
 * Ad-hoc ping endpoint: `POST /api/v1/ping`. Runs one HTTP, DNS or TCP check against a
 * target described entirely in the request body, returns what it observed, and forgets
 * it. Nothing is stored, no monitor is created or touched, and no alert is dispatched —
 * the caller is the only consumer of the result.
 *
 * It exists for the checks that have no business becoming monitors. A deploy pipeline
 * that wants to know whether the preview app it just published answers on its freshly
 * minted subdomain would otherwise have to create a monitor, wait for a scheduled check,
 * read the result, and delete the monitor again — four calls and a polling loop to learn
 * something one request can answer.
 *
 * A ping performed here is a ping billed here: it costs the same metered unit as a
 * monitor's scheduled check, which is why the endpoint refuses a team without an active
 * subscription rather than quietly doing unbilled work.
 *
 * The check itself is not implemented here. HTTP goes through `HttpCheck`, the same class
 * `CheckHttpJob` probes monitors with; DNS and TCP go through `checkDns` and
 * `checkTcpConnection`, the same functions their sweeps use. What this controller owns is
 * the request contract, the guards, and the fact that none of the monitor-shaped
 * side effects run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding } from "@pkg/rate-limit";
import type { Middleware } from "remix/fetch-router";

import { BadRequest, PaymentRequired } from "@pkg/http/status-code";
import { CloudflareAdapter, MemoryAdapter } from "@pkg/rate-limit";
import { rateLimit } from "@pkg/rate-limit/middleware";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { generateUUID } from "@pkg/uuid";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { ContentCheckRule } from "~/app/data/content-check";
import type { PingStatus } from "~/app/services/analytics";
import type { DnsRecordType } from "~/app/services/dns-check";

import Subscription from "~/app/data/subscription";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { recordAdhocPing } from "~/app/services/adhoc-ping";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { apportionCostByTeam } from "~/app/services/cost";
import { checkDns } from "~/app/services/dns-check";
import { HttpCheck } from "~/app/services/http-check";
import { checkTcpConnection } from "~/app/services/tcp-check";
import routes from "~/routes/web";

/**
 * Regions a ping may be probed from, matching the `location_hint` column HTTP monitors
 * carry so an ad-hoc check and a monitored one measure the same thing from the same place.
 */
const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

/** Record types a DNS ping may resolve, matching what DNS monitors support. */
const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;

/** Methods a ping may use, matching what an HTTP monitor may be configured with. */
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;

/** The subset of {@link HTTP_METHODS} the platform refuses to attach a request body to. */
const BODYLESS_METHODS: readonly string[] = ["GET", "HEAD"];

/**
 * Requests one API key may spend per {@link CALLER_WINDOW}, mirroring the `simple.limit`
 * declared for the `RATE_LIMITER` binding in `wrangler.jsonc` (the binding reports
 * neither, so the two are kept in step by hand).
 *
 * This is an abuse bound, not a product one. The endpoint is authenticated, subscribed
 * and metered, so a caller running it hard is a caller paying for it — what the limit
 * stops is a runaway CI loop turning a stuck retry into an unbounded bill before anyone
 * notices. Sixty a minute is far above any pipeline's real rate.
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
 * The request body, discriminated on `type`. Bounds mirror the monitor validators, so a
 * target that would be rejected as a monitor is rejected here too and nobody can use the
 * ad-hoc path to ask for a probe the scheduled path would refuse.
 *
 * Each discriminator passes its type argument explicitly (`s.literal<"http">`) rather
 * than letting it be inferred: `literal`'s parameter is not declared `const`, so an
 * inferred `"http"` widens to `string` and the parsed union stops being discriminated —
 * {@link run} would have nothing to narrow on and every branch would see every field.
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
		 * Rejected here rather than left to the probe: constructing a GET or HEAD request
		 * with a body throws a `TypeError`, which `probe` cannot tell apart from the
		 * Durable Object being unavailable, so it would surface as a 500 on a request that
		 * is simply malformed. This is the only cross-field rule the body has.
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
 * The `RATE_LIMITER` binding, when the running deployment declares one.
 *
 * Read structurally rather than off the generated `Cloudflare.Env`, which is what lets an
 * absent binding be a supported state instead of a crash: a deploy predating the
 * `ratelimits` entry, or a local runtime configured without it, still serves pings.
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
 * Backend counting the caller budget. The binding bills nothing per call; without it the
 * count falls back to the isolate's own memory, which is weaker (each isolate gets its
 * own budget) but free and still bounds a single connection's flood.
 *
 * @returns The adapter to count with.
 */
function createAdapter(): Adapter {
	// `as const` keeps the window a duration literal rather than widening it to `string`,
	// which is what both adapters' options accept.
	let options = { limit: CALLER_LIMIT, window: CALLER_WINDOW } as const;
	let binding = rateLimiterBinding();

	if (binding === undefined) return new MemoryAdapter(options);
	return new CloudflareAdapter(binding, options);
}

/**
 * The caller budget, built on the first request and reused by the isolate after that: the
 * adapter reads a binding off `env`, which is not module-scope work.
 */
let limiter: Middleware | undefined;

/**
 * Spends one API key's budget before the handler runs.
 *
 * Keyed on the key itself rather than the calling address, unlike the unauthenticated
 * cron-job ping endpoint: this request already proved who it is, and the budget should
 * follow the key across however many CI runners share an egress address — or move with
 * it when one runner is replaced. Runs after `requireApiKey`, which is what puts
 * `ctx.apiKey` there to read.
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
		 * `stateFor`, not `isActive`: an owner whose subscription state cannot be determined
		 * fails open and gets their ping, which is the same reading the manual "run check"
		 * button takes. Refusing a paying customer because a lookup was inconclusive is the
		 * worse of the two mistakes.
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

		recordAdhocPing({
			id,
			team: ctx.apiTeam,
			status: result.status,
			responseTimeMs: result.responseTimeMs,
		});

		/**
		 * Always 200, whatever the target did. A refused connection or an unexpected status
		 * is the answer the caller asked for, not a failure of this request — the non-2xx
		 * responses above are reserved for the request itself being wrong. A CI script
		 * therefore branches on `data.ping.status`, never on the HTTP status.
		 */
		return apiSuccess({
			ping: {
				id,
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
		 * Sharded on the URL rather than on the ping's own id, which is fresh every time:
		 * a pipeline checking one endpoint on every deploy then keeps hitting the same
		 * warm Durable Object instead of scattering across all eight in its region.
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
	 * `previousValue` is null because an ad-hoc ping has no previous check to have changed
	 * from. A `changed` status therefore only ever means "did not match the
	 * `expectedValue` you gave me", which is the only comparison a stateless caller can
	 * meaningfully ask for.
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
 * true by construction: a caller who didn't want a rule applied would not have sent it,
 * unlike a stored check, which has a toggle because it outlives the request.
 */
function toContentCheckRule(check: s.InferOutput<typeof ContentCheckSchema>): ContentCheckRule {
	return {
		type: check.type,
		value: check.value,
		case_sensitive: check.caseSensitive,
		is_enabled: true,
	};
}
