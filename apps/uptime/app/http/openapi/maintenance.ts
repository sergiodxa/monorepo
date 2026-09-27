/**
 * The maintenance window operations of the API document: the collection, one window and
 * ending it early. The request schemas here are the ones the controllers validate with,
 * so the published contract and the enforced one are the same values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";

import { envelope, PAGE_QUERY, pageResponse } from "~/app/http/openapi/envelope";
import { epochMs, resourceId } from "~/app/http/openapi/fields";
import { MONITOR_SCOPE_TYPES } from "~/app/lib/monitor-scope";
import { typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

/** The tag grouping every operation in this module. */
const TAGS = ["Maintenance windows"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** A maintenance window as `serializeMaintenanceWindow` writes it. */
const MAINTENANCE_WINDOW = s
	.object({
		id: resourceId("mnt"),
		teamId: resourceId("team"),
		monitorType: s
			.nullable(s.enum_(MONITOR_SCOPE_TYPES))
			.meta({ description: "Monitor type the window covers; null covers every type" }),
		monitorId: s
			.nullable(s.string())
			.meta({ description: "The one monitor the window covers; null covers the whole type" }),
		name: s.string(),
		startsAt: epochMs(),
		endsAt: epochMs(),
		endedEarlyAt: s
			.nullable(epochMs())
			.meta({ description: "When the window was ended early; null while it runs its course" }),
		suppressAlerts: s.boolean(),
		showOnStatusPage: s.boolean(),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "MaintenanceWindow" });

/**
 * An ISO-8601 date-time in a request body, parsed into the epoch milliseconds the window
 * stores, so every date a caller sends compares against the stored ones directly.
 */
function isoDateTime() {
	return s
		.string()
		.refine((value: string) => Number.isFinite(new Date(value).getTime()), "Invalid date/time.")
		.meta({ format: "date-time" })
		.transform((value: string) => new Date(value).getTime(), s.integer());
}

/** A window's name, which must hold at least one character. */
function windowName() {
	return s
		.string()
		.refine((value: string) => value.length > 0, "Name is required.")
		.meta({ description: "At least one character" });
}

/** The path params naming one maintenance window. */
export const MAINTENANCE_ID_PARAMS = s.object({ maintenanceId: typedId("mnt") });

/** The body `POST /api/v1/maintenance` accepts; `endsAt` must follow `startsAt`. */
export const CREATE_MAINTENANCE_BODY = s
	.object({
		name: windowName(),
		/**
		 * Which monitor table `monitorId` names, or, alone, the whole type it covers.
		 *
		 * Stays optional beside an id for compatibility: `monitorId` alone meant an HTTP monitor
		 * before this field existed, and requests still sending just that resolve the same way.
		 */
		monitorType: s.optional(
			s.enum_(MONITOR_SCOPE_TYPES).meta({ description: "Defaults to `http` beside a `monitorId`" }),
		),
		monitorId: s.optional(s.nullable(s.string())),
		startsAt: isoDateTime(),
		endsAt: isoDateTime().meta({ description: "Must follow `startsAt`" }),
		suppressAlerts: s.defaulted(s.boolean(), true),
		showOnStatusPage: s.defaulted(s.boolean(), true),
	})
	.refine((value) => value.endsAt > value.startsAt, "endsAt must be after startsAt");

/**
 * The body `PUT /api/v1/maintenance/{maintenanceId}` accepts; every field is optional.
 * The window's resulting `endsAt` must still follow its `startsAt`.
 */
export const UPDATE_MAINTENANCE_BODY = s.object({
	name: s.optional(windowName()),
	monitorType: s.optional(s.enum_(MONITOR_SCOPE_TYPES)),
	monitorId: s.optional(s.nullable(s.string())),
	startsAt: s.optional(isoDateTime()),
	endsAt: s.optional(isoDateTime()),
	suppressAlerts: s.optional(s.boolean()),
	showOnStatusPage: s.optional(s.boolean()),
});

const MAINTENANCE_INDEX = defineOperation("maintenanceIndex", routes.api.v1.maintenance.index, {
	summary: "List maintenance windows",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the team's maintenance windows", {
			maintenanceWindows: s.array(MAINTENANCE_WINDOW),
		}),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["maintenance:read"] }],
});

const MAINTENANCE_CREATE = defineOperation("maintenanceCreate", routes.api.v1.maintenance.create, {
	summary: "Schedule a maintenance window",
	tags: TAGS,
	body: CREATE_MAINTENANCE_BODY,
	responses: {
		201: {
			description: "The created maintenance window",
			body: envelope({ maintenanceWindow: MAINTENANCE_WINDOW }),
		},
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound", ...IDEMPOTENCY_PROBLEMS],
	security: [{ apiKey: ["maintenance:write"] }],
});

const MAINTENANCE_SHOW = defineOperation("maintenanceShow", routes.api.v1.maintenance.show, {
	summary: "Show a maintenance window",
	tags: TAGS,
	params: MAINTENANCE_ID_PARAMS,
	responses: {
		200: {
			description: "The maintenance window",
			body: envelope({ maintenanceWindow: MAINTENANCE_WINDOW }),
		},
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["maintenance:read"] }],
});

const MAINTENANCE_UPDATE = defineOperation("maintenanceUpdate", routes.api.v1.maintenance.update, {
	summary: "Update a maintenance window",
	tags: TAGS,
	params: MAINTENANCE_ID_PARAMS,
	body: UPDATE_MAINTENANCE_BODY,
	responses: {
		200: {
			description: "The updated maintenance window",
			body: envelope({ maintenanceWindow: MAINTENANCE_WINDOW }),
		},
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["maintenance:write"] }],
});

const MAINTENANCE_DESTROY = defineOperation(
	"maintenanceDestroy",
	routes.api.v1.maintenance.destroy,
	{
		summary: "Delete a maintenance window",
		tags: TAGS,
		params: MAINTENANCE_ID_PARAMS,
		responses: {
			200: {
				description: "The maintenance window is deleted",
				body: envelope({ deleted: s.literal(true) }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["maintenance:write"] }],
	},
);

const MAINTENANCE_END = defineOperation("maintenanceEnd", routes.api.v1.maintenance.end, {
	summary: "End a maintenance window early",
	tags: TAGS,
	params: MAINTENANCE_ID_PARAMS,
	responses: {
		200: {
			description: "The window, with `endedEarlyAt` set",
			body: envelope({ maintenanceWindow: MAINTENANCE_WINDOW }),
		},
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["maintenance:write"] }],
});

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	MAINTENANCE_INDEX,
	MAINTENANCE_CREATE,
	MAINTENANCE_SHOW,
	MAINTENANCE_UPDATE,
	MAINTENANCE_DESTROY,
	MAINTENANCE_END,
];
