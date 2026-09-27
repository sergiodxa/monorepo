/**
 * The HTTP monitor operations of the API document: the collection, one monitor, its
 * history and its content checks. The request schemas here are the ones the controllers
 * validate with, so the published contract and the enforced one are the same values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import { envelope, PAGE_QUERY, pageResponse } from "~/app/http/openapi/envelope";
import { epochMs, resourceId } from "~/app/http/openapi/fields";
import { typedId } from "~/app/services/typed-id";
import { alertEventStatuses } from "~/database/schema";
import routes from "~/routes/web";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;
const SSL_STATUSES = ["unknown", "valid", "expiring", "expired", "error"] as const;
const CONTENT_CHECK_TYPES = ["contains", "not_contains", "regex"] as const;

/** The tag grouping every operation in this module. */
const TAGS = ["HTTP monitors"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** A monitor as `serializeMonitor` writes it. */
export const MONITOR = s
	.object({
		id: resourceId("mon"),
		name: s.string(),
		url: s.string(),
		method: s.enum_(HTTP_METHODS),
		expectedStatus: s.integer(),
		intervalSeconds: s.integer(),
		degradedAfterMs: s.integer(),
		timeoutSeconds: s.integer(),
		locationHint: s.enum_(LOCATION_HINTS),
		enabledAt: s.nullable(epochMs()).meta({ description: "When checks resumed; null if paused" }),
		sslMonitoringEnabled: s.boolean(),
		sslExpiryWarningDays: s.integer(),
		sslExpiresAt: s.nullable(epochMs()),
		sslIssuer: s.nullable(s.string()),
		sslStatus: s.nullable(s.enum_(SSL_STATUSES)),
		sslLastCheckedAt: s.nullable(epochMs()),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "Monitor" });

/** Aggregates over completed checks; `p99` covers the last 24 hours. */
const STATS = s
	.object({
		total: s.integer(),
		uptime: s.nullable(s.number()).meta({ description: "Percentage of checks that passed" }),
		lastCheck: s.nullable(epochMs()),
		p99: s.nullable(s.number()).meta({ description: "p99 response time in ms, last 24 hours" }),
	})
	.meta({ id: "MonitorStats" });

/** One check result; its id is the scheduled job id, a monitor and a minute. */
const MONITOR_RESULT = s
	.object({
		id: s.string(),
		responseStatus: s.nullable(s.integer()),
		responseTimeMs: s.nullable(s.integer()),
		completedAt: s.nullable(epochMs()),
		createdAt: epochMs(),
	})
	.meta({ id: "MonitorResult" });

/** One alert delivery for a monitor. */
export const ALERT_EVENT = s
	.object({
		id: resourceId("evt"),
		alertId: resourceId("alt"),
		monitorId: s.string(),
		eventType: s.enum_(["down", "up", "degraded"]),
		status: s.enum_(alertEventStatuses),
		sentAt: epochMs(),
		errorMessage: s.nullable(s.string()),
		createdAt: epochMs(),
	})
	.meta({ id: "AlertEvent" });

/** A content check as `serializeContentCheck` writes it. */
const CONTENT_CHECK = s
	.object({
		id: resourceId("chk"),
		monitorId: resourceId("mon"),
		type: s.enum_(CONTENT_CHECK_TYPES),
		value: s.string(),
		caseSensitive: s.boolean(),
		isEnabled: s.boolean(),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "ContentCheck" });

/** The path params naming one monitor. */
export const MONITOR_ID_PARAMS = s.object({ monitorId: typedId("mon") });

/** The path params naming one content check on one monitor. */
export const CONTENT_CHECK_PARAMS = s.object({
	monitorId: typedId("mon"),
	contentCheckId: typedId("chk"),
});

/** The members a monitor is created with; omitted ones take their defaults. */
const MONITOR_FIELDS = {
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	url: s.string().pipe(checks.url()),
	method: s.defaulted(s.enum_(HTTP_METHODS), "HEAD"),
	expectedStatus: s.defaulted(s.number().pipe(checks.min(100), checks.max(599)), 200),
	intervalSeconds: s.defaulted(s.number().pipe(checks.min(60), checks.max(3600)), 60),
	degradedAfterMs: s.defaulted(s.number().pipe(checks.min(1000), checks.max(30_000)), 5000),
	timeoutSeconds: s.defaulted(s.number().pipe(checks.min(1), checks.max(60)), 10),
	locationHint: s.defaulted(s.enum_(LOCATION_HINTS), "wnam"),
	sslMonitoringEnabled: s.defaulted(s.boolean(), false),
	sslExpiryWarningDays: s.defaulted(s.number().pipe(checks.min(1), checks.max(365)), 30),
};

/** The body `POST /api/v1/monitors` accepts. */
export const CREATE_MONITOR_BODY = s.object(MONITOR_FIELDS);

/**
 * A monitor's writable members, which an update's merge patch must leave valid. `enabled`
 * stands for `enabledAt`, the one member an update sets that a create does not.
 */
export const WRITABLE_MONITOR = s.object({
	...MONITOR_FIELDS,
	enabled: s.defaulted(s.boolean().meta({ description: "`false` pauses checks" }), true),
});

/** The body `PUT /api/v1/monitors/{monitorId}` accepts; every field is optional. */
export const UPDATE_MONITOR_BODY = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	url: s.optional(s.string().pipe(checks.url())),
	method: s.optional(s.enum_(HTTP_METHODS)),
	expectedStatus: s.optional(s.number().pipe(checks.min(100), checks.max(599))),
	intervalSeconds: s.optional(s.number().pipe(checks.min(60), checks.max(3600))),
	degradedAfterMs: s.optional(s.number().pipe(checks.min(1000), checks.max(30_000))),
	timeoutSeconds: s.optional(s.number().pipe(checks.min(1), checks.max(60))),
	locationHint: s.optional(s.enum_(LOCATION_HINTS)),
	enabled: s.optional(s.boolean().meta({ description: "`false` pauses checks" })),
	sslMonitoringEnabled: s.optional(s.boolean()),
	sslExpiryWarningDays: s.optional(s.number().pipe(checks.min(1), checks.max(365))),
});

/**
 * The patch an update documents: every member optional, and `null` removing one, which
 * gives it its default. The handler validates the patched monitor with
 * {@link WRITABLE_MONITOR}, so the limits are the create body's.
 */
const MONITOR_PATCH = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	url: s.optional(s.string().pipe(checks.url())),
	method: s.optional(s.nullable(s.enum_(HTTP_METHODS))),
	expectedStatus: s.optional(s.nullable(s.number().pipe(checks.min(100), checks.max(599)))),
	intervalSeconds: s.optional(s.nullable(s.number().pipe(checks.min(60), checks.max(3600)))),
	degradedAfterMs: s.optional(s.nullable(s.number().pipe(checks.min(1000), checks.max(30_000)))),
	timeoutSeconds: s.optional(s.nullable(s.number().pipe(checks.min(1), checks.max(60)))),
	locationHint: s.optional(s.nullable(s.enum_(LOCATION_HINTS))),
	enabled: s.optional(s.nullable(s.boolean().meta({ description: "`false` pauses checks" }))),
	sslMonitoringEnabled: s.optional(s.nullable(s.boolean())),
	sslExpiryWarningDays: s.optional(s.nullable(s.number().pipe(checks.min(1), checks.max(365)))),
});

/** The body a content-check create accepts; a `regex` value must compile. */
export const CREATE_CONTENT_CHECK_BODY = s
	.object({
		type: s.enum_(CONTENT_CHECK_TYPES),
		value: s.string().pipe(checks.minLength(1)),
		caseSensitive: s.defaulted(s.boolean(), false),
		isEnabled: s.defaulted(s.boolean(), true),
	})
	.refine((value) => {
		if (value.type !== "regex") return true;
		try {
			new RegExp(value.value);
			return true;
		} catch {
			return false;
		}
	}, "Invalid regular expression");

const MONITORS_INDEX = defineOperation("monitorsIndex", routes.api.v1.monitors.index, {
	summary: "List HTTP monitors",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: { 200: pageResponse("A page of the team's monitors", { monitors: s.array(MONITOR) }) },
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["monitors:read"] }],
});

const MONITORS_CREATE = defineOperation("monitorsCreate", routes.api.v1.monitors.create, {
	summary: "Create an HTTP monitor",
	tags: TAGS,
	body: CREATE_MONITOR_BODY,
	responses: { 201: { description: "The created monitor", body: envelope({ monitor: MONITOR }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS],
	security: [{ apiKey: ["monitors:write"] }],
});

const MONITORS_STATS = defineOperation("monitorsStats", routes.api.v1.monitors.stats, {
	summary: "Show stats across the team's HTTP monitors",
	tags: TAGS,
	responses: { 200: { description: "The team's stats", body: envelope({ stats: STATS }) } },
	problems: AUTH_PROBLEMS,
	security: [{ apiKey: ["monitors:read"] }],
});

const MONITOR_SHOW = defineOperation("monitorShow", routes.api.v1.monitors.show, {
	summary: "Show an HTTP monitor",
	tags: TAGS,
	params: MONITOR_ID_PARAMS,
	responses: { 200: { description: "The monitor", body: envelope({ monitor: MONITOR }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["monitors:read"] }],
});

const MONITOR_PATCH_OPERATION = defineOperation("monitorPatch", routes.api.v1.monitors.patch, {
	summary: "Update an HTTP monitor",
	description:
		"An RFC 7396 JSON merge patch: send the members to change; `null` resets one to its default.",
	tags: TAGS,
	params: MONITOR_ID_PARAMS,
	body: { "application/merge-patch+json": MONITOR_PATCH, "application/json": MONITOR_PATCH },
	responses: { 200: { description: "The updated monitor", body: envelope({ monitor: MONITOR }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound", "unsupportedMediaType"],
	security: [{ apiKey: ["monitors:write"] }],
});

const MONITOR_UPDATE = defineOperation("monitorUpdate", routes.api.v1.monitors.update, {
	summary: "Update an HTTP monitor (PUT)",
	tags: TAGS,
	params: MONITOR_ID_PARAMS,
	body: UPDATE_MONITOR_BODY,
	responses: { 200: { description: "The updated monitor", body: envelope({ monitor: MONITOR }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["monitors:write"] }],
});

const MONITOR_DESTROY = defineOperation("monitorDestroy", routes.api.v1.monitors.destroy, {
	summary: "Delete an HTTP monitor",
	tags: TAGS,
	params: MONITOR_ID_PARAMS,
	responses: {
		200: { description: "The monitor is deleted", body: envelope({ deleted: s.literal(true) }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["monitors:write"] }],
});

const MONITOR_STATS = defineOperation("monitorStats", routes.api.v1.monitors.itemStats, {
	summary: "Show an HTTP monitor's stats",
	tags: TAGS,
	params: MONITOR_ID_PARAMS,
	responses: {
		200: { description: "The monitor's stats", body: envelope({ stats: STATS }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["monitors:read"] }],
});

const MONITOR_RESULTS = defineOperation("monitorResults", routes.api.v1.monitors.results, {
	summary: "List an HTTP monitor's check results",
	tags: TAGS,
	params: MONITOR_ID_PARAMS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of check results, newest first", {
			results: s.array(MONITOR_RESULT),
		}),
	},
	problems: ["validationError", "badRequest", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["monitors:read"] }],
});

const MONITOR_ALERT_EVENTS = defineOperation(
	"monitorAlertEvents",
	routes.api.v1.monitors.alertEvents,
	{
		summary: "List an HTTP monitor's alert deliveries",
		tags: TAGS,
		params: MONITOR_ID_PARAMS,
		query: PAGE_QUERY,
		responses: {
			200: pageResponse("A page of alert deliveries, newest first", {
				events: s.array(ALERT_EVENT),
			}),
		},
		problems: ["validationError", "badRequest", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["alerts:read"] }],
	},
);

const MONITOR_CONTENT_CHECKS_INDEX = defineOperation(
	"monitorContentChecksIndex",
	routes.api.v1.monitors.contentChecks.index,
	{
		summary: "List an HTTP monitor's content checks",
		tags: TAGS,
		params: MONITOR_ID_PARAMS,
		query: PAGE_QUERY,
		responses: {
			200: pageResponse("A page of content checks", { contentChecks: s.array(CONTENT_CHECK) }),
		},
		problems: ["validationError", "badRequest", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["monitors:read"] }],
	},
);

const MONITOR_CONTENT_CHECKS_CREATE = defineOperation(
	"monitorContentChecksCreate",
	routes.api.v1.monitors.contentChecks.create,
	{
		summary: "Add a content check to an HTTP monitor",
		tags: TAGS,
		params: MONITOR_ID_PARAMS,
		body: CREATE_CONTENT_CHECK_BODY,
		responses: {
			201: {
				description: "The created content check",
				body: envelope({ contentCheck: CONTENT_CHECK }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound", ...IDEMPOTENCY_PROBLEMS],
		security: [{ apiKey: ["monitors:write"] }],
	},
);

const MONITOR_CONTENT_CHECK_DESTROY = defineOperation(
	"monitorContentCheckDestroy",
	routes.api.v1.monitors.contentChecks.destroy,
	{
		summary: "Delete a content check",
		tags: TAGS,
		params: CONTENT_CHECK_PARAMS,
		responses: {
			200: {
				description: "The content check is deleted",
				body: envelope({ success: s.literal(true) }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["monitors:write"] }],
	},
);

const BACKFILL_DAILY_STATS_CREATE = defineOperation(
	"backfillDailyStatsCreate",
	routes.api.v1.backfillDailyStats,
	{
		summary: "Queue a daily-stats rollup",
		tags: TAGS,
		responses: {
			202: {
				description: "The rollup is queued",
				body: envelope({ status: s.literal("queued") }),
			},
		},
		problems: AUTH_PROBLEMS,
		security: [{ apiKey: ["monitors:write"] }],
	},
);

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	MONITORS_INDEX,
	MONITORS_CREATE,
	MONITORS_STATS,
	MONITOR_SHOW,
	MONITOR_PATCH_OPERATION,
	MONITOR_UPDATE,
	MONITOR_DESTROY,
	MONITOR_STATS,
	MONITOR_RESULTS,
	MONITOR_ALERT_EVENTS,
	MONITOR_CONTENT_CHECKS_INDEX,
	MONITOR_CONTENT_CHECKS_CREATE,
	MONITOR_CONTENT_CHECK_DESTROY,
	BACKFILL_DAILY_STATS_CREATE,
];
