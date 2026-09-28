/**
 * The alert operations of the API document: the collection, one alert and its delivery
 * history. The request schemas here are the ones the controllers validate with, so the
 * published contract and the enforced one are the same values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import { envelope, PAGE_QUERY, pageResponse } from "~/app/http/openapi/envelope";
import { epochMs, resourceId } from "~/app/http/openapi/fields";
import { ALERT_EVENT } from "~/app/http/openapi/monitors";
import { deliverableAddress, emailAddress } from "~/app/http/validators/email-address";
import { DEFAULT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import { MONITOR_SCOPE_TYPES } from "~/app/lib/monitor-scope";
import { typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

const ALERT_STRATEGIES = ["email", "webhook", "slack", "discord"] as const;

/** The tag grouping every operation in this module. */
const TAGS = ["Alerts"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** The scope pair both alert shapes carry; a null `monitorId` covers every monitor in scope. */
const SCOPE_FIELDS = {
	monitorType: s
		.nullable(s.enum_(MONITOR_SCOPE_TYPES))
		.meta({ description: "Monitor type the alert covers; null covers every type" }),
	monitorId: s
		.nullable(s.string())
		.meta({ description: "The one monitor the alert covers; null covers the whole type" }),
};

/** An alert's channel as a read returns it: webhook URLs and secrets stay server-side. */
const ALERT_CHANNEL = s.variant("strategy", {
	email: s.object({ strategy: s.literal("email"), to: s.string(), subjectPrefix: s.string() }),
	webhook: s.object({ strategy: s.literal("webhook") }),
	slack: s.object({ strategy: s.literal("slack"), channel: s.optional(s.string()) }),
	discord: s.object({ strategy: s.literal("discord") }),
});

/** An alert as `serializeAlertSafe` writes it, for the list and show endpoints. */
const ALERT = s
	.object({
		id: resourceId("alt"),
		name: s.string(),
		notifyOnRecovery: s.boolean(),
		cooldownMinutes: s.integer(),
		config: ALERT_CHANNEL,
		...SCOPE_FIELDS,
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "Alert" });

/** An alert as create and update return it: its channel reports only the strategy. */
const ALERT_SUMMARY = s
	.object({
		id: resourceId("alt"),
		name: s.string(),
		notifyOnRecovery: s.boolean(),
		cooldownMinutes: s.integer(),
		...SCOPE_FIELDS,
		config: s.object({ strategy: s.enum_(ALERT_STRATEGIES) }),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "AlertSummary" });

/** The fields every strategy of a create accepts beside its channel settings. */
const COMMON_ALERT_FIELDS = {
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	notifyOnRecovery: s.defaulted(s.boolean(), true),
	/**
	 * Defaults to {@link DEFAULT_COOLDOWN_MINUTES}, matching the dashboard form's
	 * cadence, so alerts behave consistently regardless of the creating surface.
	 * Callers wanting immediate repeats can still send `0` explicitly.
	 */
	cooldownMinutes: s.defaulted(
		s.number().pipe(checks.min(0), checks.max(1440)),
		DEFAULT_COOLDOWN_MINUTES,
	),
	/**
	 * Which monitor table `monitorId` names, or the whole type to watch on its own.
	 * Optional for compatibility: `monitorId` shipped first and always meant an
	 * HTTP monitor, so an id sent alone still resolves that way.
	 */
	monitorType: s.optional(
		s.enum_(MONITOR_SCOPE_TYPES).meta({ description: "Defaults to `http` beside a `monitorId`" }),
	),
	monitorId: s.optional(s.string()),
};

/** The path params naming one alert. */
export const ALERT_ID_PARAMS = s.object({ alertId: typedId("alt") });

/**
 * The body `POST /api/v1/alerts` accepts, one shape per channel strategy, and the shape a
 * `PATCH`'s merge patch must leave an alert in.
 */
export const CREATE_ALERT_BODY = s.variant("strategy", {
	email: s.object({
		strategy: s.literal("email"),
		email: s.string().pipe(emailAddress()).transform(deliverableAddress),
		subjectPrefix: s.optional(s.string().pipe(checks.maxLength(100))),
		...COMMON_ALERT_FIELDS,
	}),
	webhook: s.object({
		strategy: s.literal("webhook"),
		url: s.string().pipe(checks.url()),
		secret: s.optional(s.string().pipe(checks.maxLength(255))),
		...COMMON_ALERT_FIELDS,
	}),
	slack: s.object({
		strategy: s.literal("slack"),
		webhookUrl: s.string().pipe(checks.url()),
		channel: s.optional(s.string().pipe(checks.maxLength(100))),
		...COMMON_ALERT_FIELDS,
	}),
	discord: s.object({
		strategy: s.literal("discord"),
		webhookUrl: s.string().pipe(checks.url()),
		...COMMON_ALERT_FIELDS,
	}),
});

/**
 * The body `PUT /api/v1/alerts/{alertId}` accepts. The channel is fixed at creation;
 * sending either scope field rewrites both, and a null `monitorId` widens to the type.
 */
export const UPDATE_ALERT_BODY = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	notifyOnRecovery: s.optional(s.boolean()),
	cooldownMinutes: s.optional(s.number().pipe(checks.min(0), checks.max(1440))),
	monitorType: s.optional(s.enum_(MONITOR_SCOPE_TYPES)),
	monitorId: s.optional(s.nullable(s.string())),
});

/**
 * The patch a `PATCH` documents: every member optional, and `null` removing one, which
 * clears the scope or an optional channel setting and resets a defaulted member. The
 * patched alert must pass {@link CREATE_ALERT_BODY}, so the limits are the create body's.
 */
const ALERT_PATCH = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	notifyOnRecovery: s.optional(s.nullable(s.boolean())),
	cooldownMinutes: s.optional(s.nullable(s.number().pipe(checks.min(0), checks.max(1440)))),
	monitorType: s.optional(
		s.nullable(s.enum_(MONITOR_SCOPE_TYPES)).meta({
			description: "Sent without `monitorId`, widens the alert to the whole type",
		}),
	),
	monitorId: s.optional(
		s.nullable(s.string()).meta({ description: "`null` widens the alert to every monitor" }),
	),
	strategy: s.optional(
		s.enum_(ALERT_STRATEGIES).meta({
			description: "Switching strategy requires the new strategy's settings",
		}),
	),
	email: s.optional(s.string().pipe(emailAddress()).meta({ description: "`email` strategy" })),
	subjectPrefix: s.optional(s.nullable(s.string().pipe(checks.maxLength(100)))),
	url: s.optional(s.string().pipe(checks.url()).meta({ description: "`webhook` strategy" })),
	secret: s.optional(s.nullable(s.string().pipe(checks.maxLength(255)))),
	webhookUrl: s.optional(
		s.string().pipe(checks.url()).meta({ description: "`slack` and `discord` strategies" }),
	),
	channel: s.optional(s.nullable(s.string().pipe(checks.maxLength(100)))),
});

const ALERTS_INDEX = defineOperation("alertsIndex", routes.api.v1.alerts.index, {
	summary: "List alerts",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: { 200: pageResponse("A page of the team's alerts", { alerts: s.array(ALERT) }) },
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["alerts:read"] }],
});

const ALERTS_CREATE = defineOperation("alertsCreate", routes.api.v1.alerts.create, {
	summary: "Create an alert",
	tags: TAGS,
	body: CREATE_ALERT_BODY,
	responses: {
		201: { description: "The created alert", body: envelope({ alert: ALERT_SUMMARY }) },
	},
	problems: [
		"validationError",
		"limitExceeded",
		...AUTH_PROBLEMS,
		"notFound",
		...IDEMPOTENCY_PROBLEMS,
	],
	security: [{ apiKey: ["alerts:write"] }],
});

const ALERT_SHOW = defineOperation("alertShow", routes.api.v1.alerts.show, {
	summary: "Show an alert",
	tags: TAGS,
	params: ALERT_ID_PARAMS,
	responses: { 200: { description: "The alert", body: envelope({ alert: ALERT }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["alerts:read"] }],
});

const ALERT_PATCH_OPERATION = defineOperation("alertPatch", routes.api.v1.alerts.patch, {
	summary: "Update an alert",
	description:
		"An RFC 7396 JSON merge patch: send the members to change; `null` clears or resets one.",
	tags: TAGS,
	params: ALERT_ID_PARAMS,
	body: { "application/merge-patch+json": ALERT_PATCH, "application/json": ALERT_PATCH },
	responses: {
		200: { description: "The updated alert", body: envelope({ alert: ALERT_SUMMARY }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound", "unsupportedMediaType"],
	security: [{ apiKey: ["alerts:write"] }],
});

const ALERT_UPDATE = defineOperation("alertUpdate", routes.api.v1.alerts.update, {
	summary: "Update an alert (PUT)",
	tags: TAGS,
	params: ALERT_ID_PARAMS,
	body: UPDATE_ALERT_BODY,
	responses: {
		200: { description: "The updated alert", body: envelope({ alert: ALERT_SUMMARY }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["alerts:write"] }],
});

const ALERT_DESTROY = defineOperation("alertDestroy", routes.api.v1.alerts.destroy, {
	summary: "Delete an alert",
	tags: TAGS,
	params: ALERT_ID_PARAMS,
	responses: {
		200: { description: "The alert is deleted", body: envelope({ deleted: s.literal(true) }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["alerts:write"] }],
});

const ALERT_EVENTS = defineOperation("alertEvents", routes.api.v1.alerts.events, {
	summary: "List an alert's deliveries",
	tags: TAGS,
	params: ALERT_ID_PARAMS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the alert's deliveries, newest first", {
			events: s.array(ALERT_EVENT),
		}),
	},
	problems: ["validationError", "badRequest", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["alerts:read"] }],
});

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	ALERTS_INDEX,
	ALERTS_CREATE,
	ALERT_SHOW,
	ALERT_PATCH_OPERATION,
	ALERT_UPDATE,
	ALERT_DESTROY,
	ALERT_EVENTS,
];
