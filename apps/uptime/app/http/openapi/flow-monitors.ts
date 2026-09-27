/**
 * The flow monitor operations of the API document: the collection, one monitor and its
 * check history. The request schemas here are the ones the controller validates with, so
 * the published contract and the enforced one are the same values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import { envelope, PAGE_QUERY, pageResponse } from "~/app/http/openapi/envelope";
import { epochMs, resourceId } from "~/app/http/openapi/fields";
import { MAX_SOURCE_LENGTH } from "~/app/http/validators/flow-monitor";
import { DEFAULT_FLOW_INTERVAL_SECONDS, FLOW_INTERVALS_SECONDS } from "~/app/lib/pricing";
import { typedId } from "~/app/services/typed-id";
import { flowStatuses } from "~/database/schema";
import routes from "~/routes/web";

/** The tag grouping every operation in this module. */
const TAGS = ["Flow monitors"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** A flow monitor as the API serializes it; its spec source is write-only. */
const FLOW_MONITOR = s
	.object({
		id: resourceId("flow"),
		name: s.string(),
		intervalSeconds: s.enum_(FLOW_INTERVALS_SECONDS),
		isEnabled: s.boolean(),
		lastCheckedAt: s.nullable(epochMs()),
		lastStatus: s.nullable(s.enum_(flowStatuses)),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "FlowMonitor" });

/** One flow run: its counters, and the first assertion that failed, if one did. */
const FLOW_MONITOR_RESULT = s
	.object({
		id: resourceId("flowres"),
		status: s.enum_(flowStatuses),
		testsTotal: s.integer(),
		testsPassed: s.integer(),
		testsFailed: s.integer(),
		requestsMade: s.integer().meta({ description: "HTTP requests the run made; each bills" }),
		failedTest: s.nullable(s.string()),
		failedAtLine: s.nullable(s.integer()),
		failureDetail: s.nullable(s.string()),
		durationMs: s.nullable(s.integer()),
		errorMessage: s
			.nullable(s.string())
			.meta({ description: "Why the run could not be performed; set with `error` only" }),
		checkedAt: epochMs(),
	})
	.meta({ id: "FlowMonitorResult" });

/**
 * An interval from the priced list; each value carries its own price, so an unlisted one
 * is refused rather than rounded.
 */
const INTERVAL_SECONDS = s.enum_(FLOW_INTERVALS_SECONDS);

/** The spec source; it may reach only hosts the team has verified. */
const SOURCE = s.string().pipe(checks.minLength(1), checks.maxLength(MAX_SOURCE_LENGTH));

/** The path params naming one flow monitor. */
export const FLOW_MONITOR_ID_PARAMS = s.object({ flowMonitorId: typedId("flow") });

/** The body `POST /api/v1/flow-monitors` accepts; omitted fields take their defaults. */
export const CREATE_FLOW_MONITOR_BODY = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	source: SOURCE,
	intervalSeconds: s.defaulted(INTERVAL_SECONDS, DEFAULT_FLOW_INTERVAL_SECONDS),
	isEnabled: s.defaulted(s.boolean(), true),
});

/**
 * A flow monitor's writable members, which a `PATCH` merge patch must leave valid. Every
 * member a create takes is one an update may change, so the create body is the whole set.
 */
export const WRITABLE_FLOW_MONITOR = CREATE_FLOW_MONITOR_BODY;

/**
 * The patch a `PATCH` documents: every member optional, and `null` removing one, which
 * gives it its default. The handler validates the patched monitor with
 * {@link WRITABLE_FLOW_MONITOR}, so the limits are the create body's.
 */
const FLOW_MONITOR_PATCH = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	source: s.optional(SOURCE),
	intervalSeconds: s.optional(s.nullable(INTERVAL_SECONDS)),
	isEnabled: s.optional(s.nullable(s.boolean())),
});

/** The body `PUT /api/v1/flow-monitors/{flowMonitorId}` accepts; every field is optional. */
export const UPDATE_FLOW_MONITOR_BODY = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	source: s.optional(SOURCE),
	intervalSeconds: s.optional(INTERVAL_SECONDS),
	isEnabled: s.optional(s.boolean()),
});

const FLOW_MONITORS_INDEX = defineOperation("flowMonitorsIndex", routes.api.v1.flowMonitors.index, {
	summary: "List flow monitors",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the team's flow monitors", {
			flowMonitors: s.array(FLOW_MONITOR),
		}),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["flow-monitors:read"] }],
});

const FLOW_MONITORS_CREATE = defineOperation(
	"flowMonitorsCreate",
	routes.api.v1.flowMonitors.create,
	{
		summary: "Create a flow monitor",
		tags: TAGS,
		body: CREATE_FLOW_MONITOR_BODY,
		responses: {
			201: {
				description: "The created flow monitor",
				body: envelope({ flowMonitor: FLOW_MONITOR }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS],
		security: [{ apiKey: ["flow-monitors:write"] }],
	},
);

const FLOW_MONITOR_SHOW = defineOperation("flowMonitorShow", routes.api.v1.flowMonitors.show, {
	summary: "Show a flow monitor",
	tags: TAGS,
	params: FLOW_MONITOR_ID_PARAMS,
	responses: {
		200: { description: "The flow monitor", body: envelope({ flowMonitor: FLOW_MONITOR }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["flow-monitors:read"] }],
});

const FLOW_MONITOR_PATCH_OPERATION = defineOperation(
	"flowMonitorPatch",
	routes.api.v1.flowMonitors.patch,
	{
		summary: "Update a flow monitor",
		description:
			"An RFC 7396 JSON merge patch: send the members to change; `null` resets one to its default.",
		tags: TAGS,
		params: FLOW_MONITOR_ID_PARAMS,
		body: {
			"application/merge-patch+json": FLOW_MONITOR_PATCH,
			"application/json": FLOW_MONITOR_PATCH,
		},
		responses: {
			200: {
				description: "The updated flow monitor",
				body: envelope({ flowMonitor: FLOW_MONITOR }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound", "unsupportedMediaType"],
		security: [{ apiKey: ["flow-monitors:write"] }],
	},
);

const FLOW_MONITOR_UPDATE = defineOperation(
	"flowMonitorUpdate",
	routes.api.v1.flowMonitors.update,
	{
		summary: "Update a flow monitor (PUT)",
		tags: TAGS,
		params: FLOW_MONITOR_ID_PARAMS,
		body: UPDATE_FLOW_MONITOR_BODY,
		responses: {
			200: {
				description: "The updated flow monitor",
				body: envelope({ flowMonitor: FLOW_MONITOR }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["flow-monitors:write"] }],
	},
);

const FLOW_MONITOR_DESTROY = defineOperation(
	"flowMonitorDestroy",
	routes.api.v1.flowMonitors.destroy,
	{
		summary: "Delete a flow monitor",
		tags: TAGS,
		params: FLOW_MONITOR_ID_PARAMS,
		responses: {
			200: {
				description: "The flow monitor and its history are deleted",
				body: envelope({ deleted: s.literal(true) }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["flow-monitors:write"] }],
	},
);

const FLOW_MONITOR_RESULTS = defineOperation(
	"flowMonitorResults",
	routes.api.v1.flowMonitors.results,
	{
		summary: "List a flow monitor's check results",
		tags: TAGS,
		params: FLOW_MONITOR_ID_PARAMS,
		query: PAGE_QUERY,
		responses: {
			200: pageResponse("A page of flow runs, newest first", {
				results: s.array(FLOW_MONITOR_RESULT),
			}),
		},
		problems: ["validationError", "badRequest", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["flow-monitors:read"] }],
	},
);

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	FLOW_MONITORS_INDEX,
	FLOW_MONITORS_CREATE,
	FLOW_MONITOR_SHOW,
	FLOW_MONITOR_PATCH_OPERATION,
	FLOW_MONITOR_UPDATE,
	FLOW_MONITOR_DESTROY,
	FLOW_MONITOR_RESULTS,
];
