/**
 * The cron job operations of the API document: the collection, one cron job, and the ping
 * a scheduled job sends when it runs. The request schemas here are the ones the controllers
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
import {
	DEFAULT_TIMEZONE,
	isSupportedTimezone,
	UNKNOWN_TIMEZONE_MESSAGE,
} from "~/app/lib/timezones";
import { typedId } from "~/app/services/typed-id";
import { cronJobStatuses } from "~/database/schema";
import routes from "~/routes/web";

/** The tag grouping every operation in this module. */
const TAGS = ["Cron jobs"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** A cron job as the API serializes it. */
const CRON_JOB = s
	.object({
		id: resourceId("cron"),
		name: s.string(),
		description: s.nullable(s.string()),
		cronExpression: s.string().meta({ description: "Stored normalized" }),
		gracePeriodSeconds: s.integer(),
		timezone: s.string().meta({ description: "IANA time zone the schedule runs in" }),
		status: s.enum_(cronJobStatuses),
		alertOnLate: s.boolean(),
		lastPingAt: s.nullable(epochMs()),
		nextExpectedAt: s.nullable(epochMs()),
		enabledAt: s.nullable(epochMs()).meta({ description: "When enabled; null if disabled" }),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "CronJob" });

/** A time zone from the runtime's IANA list; the zone decides when a job counts as late. */
const TIMEZONE = s.string().refine(isSupportedTimezone, UNKNOWN_TIMEZONE_MESSAGE);

/** The path params naming one cron job. */
export const CRON_JOB_ID_PARAMS = s.object({ cronJobId: typedId("cron") });

/**
 * The path params of a ping. Crontabs written before ids carried a prefix hold the raw
 * UUID, so either form names the monitor; an id in neither form answers 404.
 */
export const CRON_JOB_PING_PARAMS = s.object({
	cronJobId: s.string().meta({ description: "The cron job's `cron_` id, or its raw UUID" }),
});

/** The body `POST /api/v1/cron-jobs` accepts; omitted fields take their defaults. */
export const CREATE_CRON_JOB_BODY = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(100)),
	description: s.optional(s.string().pipe(checks.maxLength(500))),
	cronExpression: s.string().pipe(checks.minLength(1)),
	gracePeriodSeconds: s.defaulted(s.number().pipe(checks.min(60), checks.max(86_400)), 300),
	timezone: s.defaulted(TIMEZONE, DEFAULT_TIMEZONE),
	alertOnLate: s.defaulted(s.boolean(), false),
	enabled: s.defaulted(s.boolean(), true),
});

/** The body `PUT /api/v1/cron-jobs/{cronJobId}` accepts; every field is optional. */
export const UPDATE_CRON_JOB_BODY = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(100))),
	description: s.optional(s.string().pipe(checks.maxLength(500))),
	cronExpression: s.optional(s.string().pipe(checks.minLength(1))),
	gracePeriodSeconds: s.optional(s.number().pipe(checks.min(60), checks.max(86_400))),
	timezone: s.optional(TIMEZONE),
	alertOnLate: s.optional(s.boolean()),
	enabled: s.optional(s.boolean()),
});

const CRON_JOBS_INDEX = defineOperation("cronJobsIndex", routes.api.v1.cronJobs.index, {
	summary: "List cron jobs",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the team's cron jobs", { cronJobs: s.array(CRON_JOB) }),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["cron-jobs:read"] }],
});

const CRON_JOBS_CREATE = defineOperation("cronJobsCreate", routes.api.v1.cronJobs.create, {
	summary: "Create a cron job",
	tags: TAGS,
	body: CREATE_CRON_JOB_BODY,
	responses: {
		201: { description: "The created cron job", body: envelope({ cronJob: CRON_JOB }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS],
	security: [{ apiKey: ["cron-jobs:write"] }],
});

const CRON_JOB_SHOW = defineOperation("cronJobShow", routes.api.v1.cronJobs.show, {
	summary: "Show a cron job",
	tags: TAGS,
	params: CRON_JOB_ID_PARAMS,
	responses: { 200: { description: "The cron job", body: envelope({ cronJob: CRON_JOB }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["cron-jobs:read"] }],
});

const CRON_JOB_UPDATE = defineOperation("cronJobUpdate", routes.api.v1.cronJobs.update, {
	summary: "Update a cron job",
	tags: TAGS,
	params: CRON_JOB_ID_PARAMS,
	body: UPDATE_CRON_JOB_BODY,
	responses: {
		200: { description: "The updated cron job", body: envelope({ cronJob: CRON_JOB }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["cron-jobs:write"] }],
});

const CRON_JOB_DESTROY = defineOperation("cronJobDestroy", routes.api.v1.cronJobs.destroy, {
	summary: "Delete a cron job",
	tags: TAGS,
	params: CRON_JOB_ID_PARAMS,
	responses: {
		200: { description: "The cron job is deleted", body: envelope({ deleted: s.literal(true) }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["cron-jobs:write"] }],
});

const CRON_JOB_PING = defineOperation("cronJobPing", routes.api.cronJobPing, {
	summary: "Record a cron job ping",
	description:
		"Answers with a bare object rather than the envelope, so a shell script reads it as is. " +
		"A caller budget per address and monitor is spent before the key is checked.",
	tags: TAGS,
	params: CRON_JOB_PING_PARAMS,
	responses: {
		201: {
			description: "The ping is recorded, on time or late",
			body: s.object({
				wasOnTime: s
					.boolean()
					.meta({ description: "False when the ping arrived after the grace period" }),
			}),
			headers: {
				RateLimit: {
					schema: s.string(),
					description: "The caller budget's quota: `limit`, `remaining` and `reset`",
				},
				"RateLimit-Policy": {
					schema: s.string(),
					description: "The caller budget's policy, as `<limit>;w=<window seconds>`",
				},
			},
		},
	},
	problems: [...AUTH_PROBLEMS, "notFound", "conflict", "rateLimited"],
	security: [{ apiKey: ["cron-jobs:ping"] }],
});

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	CRON_JOBS_INDEX,
	CRON_JOBS_CREATE,
	CRON_JOB_SHOW,
	CRON_JOB_UPDATE,
	CRON_JOB_DESTROY,
	CRON_JOB_PING,
];
