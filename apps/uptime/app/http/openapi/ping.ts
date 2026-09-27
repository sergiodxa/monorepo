/**
 * The ad-hoc ping operation of the API document: one HTTP, DNS or TCP check run on demand.
 * The request schema here is the one the controller validates with, so the published
 * contract and the enforced one are the same value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import { envelope } from "~/app/http/openapi/envelope";
import { resourceId } from "~/app/http/openapi/fields";
import { DNS_RECORD_TYPES } from "~/app/lib/dns-record-value";
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

/** One content-check rule as the request body spells it, before it becomes a rule. */
const CONTENT_CHECK_BODY = s.object({
	type: s.enum_(["contains", "not_contains", "regex"]),
	value: s.string().pipe(checks.minLength(1), checks.maxLength(1000)),
	caseSensitive: s.defaulted(s.boolean(), false),
});

/**
 * The body `POST /api/v1/ping` accepts, discriminated on `type` with bounds mirroring the
 * monitor validators. Discriminators pass their literal type explicitly, since letting it
 * infer would widen `"http"` to `string` and leave the handler nothing to narrow on.
 */
export const PING_BODY = s.variant("type", {
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
			body: s.optional(
				s
					.string()
					.pipe(checks.maxLength(10_000))
					.meta({ description: "Refused when `method` is `GET` or `HEAD`" }),
			),
			contentChecks: s.defaulted(s.array(CONTENT_CHECK_BODY), []),
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
		expectedValue: s.optional(
			s
				.string()
				.pipe(checks.maxLength(1000))
				.meta({ description: "Comma-separated for multi-value records" }),
		),
	}),
	tcp: s.object({
		type: s.literal<"tcp">("tcp"),
		host: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
		port: s.number().pipe(checks.min(1), checks.max(65_535)),
		timeoutMs: s.defaulted(s.number().pipe(checks.min(100), checks.max(60_000)), 5000),
	}),
});

/** The fields every ping result carries, whatever its type. */
const PING_RESULT_FIELDS = {
	id: resourceId("ping").meta({ description: "Identifies this ping; pings are not stored" }),
	responseTimeMs: s.number().meta({ description: "0 when the target never answered" }),
	checkedAt: s.string().meta({ format: "date-time" }),
};

/**
 * What one ping observed, discriminated on `type` like the request. A target that failed
 * is still a result: its outcome is `status`, never the HTTP status of the response.
 */
const PING = s
	.variant("type", {
		http: s.object({
			type: s.literal<"http">("http"),
			status: s.enum_(["up", "degraded", "down"]),
			responseStatus: s.nullable(s.integer()).meta({ description: "Null when unreachable" }),
			contentChecksPassed: s.boolean().meta({ description: "True when none were supplied" }),
			...PING_RESULT_FIELDS,
		}),
		dns: s.object({
			type: s.literal<"dns">("dns"),
			status: s
				.enum_(["ok", "changed", "error"])
				.meta({ description: "`changed` means the value differs from `expectedValue`" }),
			resolvedValue: s.nullable(s.string()),
			errorMessage: s.nullable(s.string()),
			...PING_RESULT_FIELDS,
		}),
		tcp: s.object({
			type: s.literal<"tcp">("tcp"),
			status: s.enum_(["up", "down", "timeout"]),
			errorMessage: s.nullable(s.string()),
			...PING_RESULT_FIELDS,
		}),
	})
	.meta({ id: "Ping" });

const PING_CREATE = defineOperation("pingCreate", routes.api.v1.ping, {
	summary: "Run an ad-hoc ping",
	description:
		"Runs one check and stores nothing. Limited to 60 requests a minute per API key; a " +
		"refused request carries `Retry-After` beside the quota headers.",
	tags: ["Ping"],
	body: PING_BODY,
	responses: {
		200: {
			description: "The check ran; its outcome is `data.ping.status`",
			body: envelope({ ping: PING }),
			headers: {
				RateLimit: {
					schema: s.string(),
					description: "The key's quota for the current window: `limit`, `remaining`, `reset`",
				},
				"RateLimit-Policy": {
					schema: s.string(),
					description: "The quota policy, as `<limit>;w=<window seconds>`",
				},
			},
		},
	},
	problems: [
		"validationError",
		"unauthorized",
		"subscriptionRequired",
		"forbidden",
		"rateLimited",
		"endpointUnavailable",
	],
	security: [{ apiKey: ["ping:trigger"] }],
});

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [PING_CREATE];
