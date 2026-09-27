/**
 * The TCP monitor operations of the API document: the collection, one monitor and its
 * check history. The request schemas here are the ones the controllers validate with, so
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
import { typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

const TCP_STATUSES = ["up", "down", "timeout"] as const;

/** The tag grouping every operation in this module. */
const TAGS = ["TCP monitors"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** A TCP monitor as `serializeTcpMonitor` writes it. */
const TCP_MONITOR = s
	.object({
		id: resourceId("tcpm"),
		name: s.string(),
		host: s.string(),
		port: s.integer(),
		timeoutMs: s.integer(),
		intervalSeconds: s.integer(),
		isEnabled: s.boolean(),
		lastCheckedAt: s.nullable(epochMs()),
		lastStatus: s.nullable(s.enum_(TCP_STATUSES)),
		lastResponseTimeMs: s.nullable(s.integer()),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "TcpMonitor" });

/** One connection attempt against a TCP monitor's host and port. */
const TCP_MONITOR_RESULT = s
	.object({
		id: resourceId("tcpr"),
		status: s.enum_(TCP_STATUSES),
		responseTimeMs: s.nullable(s.integer()),
		errorMessage: s.nullable(s.string()),
		checkedAt: epochMs(),
	})
	.meta({ id: "TcpMonitorResult" });

/** The path params naming one TCP monitor. */
export const TCP_MONITOR_ID_PARAMS = s.object({ tcpMonitorId: typedId("tcpm") });

/** The body `POST /api/v1/tcp-monitors` accepts; omitted fields take their defaults. */
export const CREATE_TCP_MONITOR_BODY = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	host: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	port: s.number().pipe(checks.min(1), checks.max(65_535)),
	timeoutMs: s.defaulted(s.number().pipe(checks.min(100), checks.max(60_000)), 5000),
	intervalSeconds: s.defaulted(s.number().pipe(checks.min(60), checks.max(86_400)), 60),
	isEnabled: s.defaulted(s.boolean(), true),
});

/** The body `PUT /api/v1/tcp-monitors/{tcpMonitorId}` accepts; every field is optional. */
export const UPDATE_TCP_MONITOR_BODY = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	host: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	port: s.optional(s.number().pipe(checks.min(1), checks.max(65_535))),
	timeoutMs: s.optional(s.number().pipe(checks.min(100), checks.max(60_000))),
	intervalSeconds: s.optional(s.number().pipe(checks.min(60), checks.max(86_400))),
	isEnabled: s.optional(s.boolean()),
});

const TCP_MONITORS_INDEX = defineOperation("tcpMonitorsIndex", routes.api.v1.tcpMonitors.index, {
	summary: "List TCP monitors",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the team's TCP monitors, newest first", {
			monitors: s.array(TCP_MONITOR),
		}),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["tcp-monitors:read"] }],
});

const TCP_MONITORS_CREATE = defineOperation("tcpMonitorsCreate", routes.api.v1.tcpMonitors.create, {
	summary: "Create a TCP monitor",
	tags: TAGS,
	body: CREATE_TCP_MONITOR_BODY,
	responses: {
		201: { description: "The created monitor", body: envelope({ monitor: TCP_MONITOR }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS],
	security: [{ apiKey: ["tcp-monitors:write"] }],
});

const TCP_MONITOR_SHOW = defineOperation("tcpMonitorShow", routes.api.v1.tcpMonitors.show, {
	summary: "Show a TCP monitor",
	tags: TAGS,
	params: TCP_MONITOR_ID_PARAMS,
	responses: { 200: { description: "The monitor", body: envelope({ monitor: TCP_MONITOR }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["tcp-monitors:read"] }],
});

const TCP_MONITOR_UPDATE = defineOperation("tcpMonitorUpdate", routes.api.v1.tcpMonitors.update, {
	summary: "Update a TCP monitor",
	tags: TAGS,
	params: TCP_MONITOR_ID_PARAMS,
	body: UPDATE_TCP_MONITOR_BODY,
	responses: {
		200: { description: "The updated monitor", body: envelope({ monitor: TCP_MONITOR }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["tcp-monitors:write"] }],
});

const TCP_MONITOR_DESTROY = defineOperation(
	"tcpMonitorDestroy",
	routes.api.v1.tcpMonitors.destroy,
	{
		summary: "Delete a TCP monitor",
		tags: TAGS,
		params: TCP_MONITOR_ID_PARAMS,
		responses: {
			200: { description: "The monitor is deleted", body: envelope({ deleted: s.literal(true) }) },
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["tcp-monitors:write"] }],
	},
);

const TCP_MONITOR_RESULTS = defineOperation(
	"tcpMonitorResults",
	routes.api.v1.tcpMonitors.results,
	{
		summary: "List a TCP monitor's check results",
		tags: TAGS,
		params: TCP_MONITOR_ID_PARAMS,
		query: PAGE_QUERY,
		responses: {
			200: pageResponse("A page of check results, newest first", {
				results: s.array(TCP_MONITOR_RESULT),
			}),
		},
		problems: ["validationError", "badRequest", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["tcp-monitors:read"] }],
	},
);

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	TCP_MONITORS_INDEX,
	TCP_MONITORS_CREATE,
	TCP_MONITOR_SHOW,
	TCP_MONITOR_UPDATE,
	TCP_MONITOR_DESTROY,
	TCP_MONITOR_RESULTS,
];
