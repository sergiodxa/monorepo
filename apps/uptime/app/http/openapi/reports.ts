/**
 * The uptime report operations of the API document: the per-monitor summary and the daily
 * rows over a range of UTC days, each answering JSON or CSV by `Accept`. The query schemas
 * here are the ones the controller validates with, so the documented filters are enforced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as coerce from "@sdxc/json-schema/coerce";
import { defineOperation } from "@sdxc/openapi";

import { envelope, pageEnvelope, pageResponse } from "~/app/http/openapi/envelope";
import { resourceId } from "~/app/http/openapi/fields";
import { MAX_REPORT_DAYS } from "~/app/lib/report-range";
import { REPORT_MONITOR_TYPES } from "~/app/lib/report-request";
import { typedId } from "~/app/services/typed-id";
import { monitorStatuses } from "~/database/schema";
import routes from "~/routes/web";

/** The tag grouping every operation in this module. */
const TAGS = ["Reports"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/**
 * What a query can refuse with: a malformed filter or range, and a status page the team
 * does not own.
 */
const FILTER_PROBLEMS = ["validationError", "notFound"] as const;

/** A UTC day as the range parameters take it; the calendar check runs in the handler. */
function utcDay(description: string) {
	return s
		.string()
		.pipe(checks.pattern(/^\d{4}-\d{2}-\d{2}$/))
		.meta({ format: "date", description });
}

/** The filters both reports read, keyed as their query parameters. */
const FILTER_FIELDS = {
	from: s.optional(
		utcDay("First UTC day, inclusive. Give it with `to`, or omit both for last month"),
	),
	to: s.optional(
		utcDay(
			`Last UTC day, inclusive: yesterday at the latest, and at most ${MAX_REPORT_DAYS} days after \`from\``,
		),
	),
	status_page_id: s.optional(
		typedId("sp").meta({ description: "Only the monitors attached to this status page" }),
	),
	monitor_type: s.optional(
		s.enum_(REPORT_MONITOR_TYPES).meta({ description: "Only monitors of this type" }),
	),
};

/** The query `GET /api/v1/reports/uptime-summary` reads. */
export const REPORT_QUERY = s.object(FILTER_FIELDS);

/**
 * The query `GET /api/v1/reports/uptime-daily` reads: the filters plus the paging the JSON
 * form follows, with the sizes `PAGING` in `app/services/pagination.ts` enforces.
 */
const DAILY_REPORT_QUERY = s.object({
	...FILTER_FIELDS,
	perPage: s.optional(
		coerce
			.number()
			.pipe(checks.min(1), checks.max(200))
			.meta({ description: "Rows per page (default 50); JSON only" }),
	),
	cursor: s.optional(
		s.string().meta({ description: "Page to fetch, from a `Link` header; JSON only" }),
	),
});

/** A monitor's id, carrying the prefix of its type. */
const MONITOR_ID = s
	.union([
		resourceId("mon"),
		resourceId("dns"),
		resourceId("tcpm"),
		resourceId("cron"),
		resourceId("flow"),
	])
	.meta({ description: "The monitor's id, prefixed by its type" });

/** The range a report covers, echoed so a request that took the default learns it. */
const RANGE = {
	from: s.string().meta({ format: "date", description: "First UTC day, inclusive" }),
	to: s.string().meta({ format: "date", description: "Last UTC day, inclusive" }),
};

/** One monitor's range, as `serializeSummaryRow` writes it. */
const UPTIME_SUMMARY = s
	.object({
		monitorId: MONITOR_ID,
		monitor: s.string().meta({ description: "The monitor's name" }),
		type: s.enum_(REPORT_MONITOR_TYPES),
		target: s.nullable(s.string()).meta({
			description: "URL, hostname, `host:port` or cron expression; null for a flow",
		}),
		daysWithData: s.integer().meta({ description: "Days in the range with a roll-up row" }),
		totalChecks: s.integer(),
		successfulChecks: s.integer(),
		failedChecks: s.integer().meta({ description: "An HTTP `degraded` check counts as failed" }),
		uptimePercent: s.nullable(s.number()).meta({
			description: "Check-weighted and unrounded, 0 to 100; null when nothing was checked",
		}),
		avgResponseTimeMs: s.nullable(s.number()).meta({
			description: "Daily averages weighted by their checks; null for a cron job",
		}),
		maxResponseTimeMs: s.nullable(s.number()),
		daysDown: s.integer(),
		daysDegraded: s.integer(),
		maintenanceMinutes: s.integer().meta({
			description: "Maintenance covering the monitor, overlaps merged; uptime includes it",
		}),
	})
	.meta({ id: "UptimeSummary" });

/** One monitor's UTC day, as `serializeDailyRow` writes it. */
const UPTIME_DAY = s
	.object({
		date: s.string().meta({ format: "date", description: "The UTC day" }),
		monitorId: MONITOR_ID,
		monitor: s.string().meta({ description: "The monitor's name" }),
		type: s.enum_(REPORT_MONITOR_TYPES),
		totalChecks: s.integer(),
		successfulChecks: s.integer(),
		failedChecks: s.integer().meta({ description: "An HTTP `degraded` check counts as failed" }),
		uptimePercent: s.nullable(s.number()).meta({
			description: "Unrounded, 0 to 100; null when the day ran no checks",
		}),
		avgResponseTimeMs: s.nullable(s.number()).meta({ description: "null for a cron job" }),
		maxResponseTimeMs: s.nullable(s.number()),
		status: s.enum_(monitorStatuses),
		maintenanceMinutes: s.integer(),
	})
	.meta({ id: "UptimeDay" });

/** The CSV form, RFC 4180 with the report's column keys as headers. */
const CSV_BODY = s.string().meta({
	description:
		"RFC 4180 CSV, comma-delimited with `.` decimals and no BOM, headed by the snake_case column keys",
});

/** The headers only the CSV form carries. */
const CSV_HEADERS = {
	"Content-Disposition": {
		schema: s.string(),
		description: "`attachment`, named `<team-slug>-<report>-<range>.csv`; CSV only",
	},
};

const REPORTS_UPTIME_SUMMARY = defineOperation(
	"reportsUptimeSummary",
	routes.api.v1.reports.uptimeSummary,
	{
		summary: "Report uptime per monitor",
		description:
			"One row per monitor over a range of whole UTC days, from the daily roll-up. `Accept: text/csv` downloads the CSV; JSON is the default.",
		tags: TAGS,
		query: REPORT_QUERY,
		responses: {
			200: {
				description: "One summary per monitor, every monitor in one response",
				body: {
					"application/json": envelope({ ...RANGE, monitors: s.array(UPTIME_SUMMARY) }),
					"text/csv": CSV_BODY,
				},
				headers: CSV_HEADERS,
			},
		},
		problems: [...FILTER_PROBLEMS, ...AUTH_PROBLEMS],
		security: [{ apiKey: ["reports:read"] }],
	},
);

/** The daily JSON page's data, shared by the page response and its body. */
const DAILY_PAGE = { ...RANGE, days: s.array(UPTIME_DAY) };

/** The paged JSON response, whose `Link` header the CSV form leaves out. */
const DAILY_PAGE_RESPONSE = pageResponse(
	"Days with a roll-up row, by monitor and then date; JSON pages, CSV holds the whole range",
	DAILY_PAGE,
);

const REPORTS_UPTIME_DAILY = defineOperation(
	"reportsUptimeDaily",
	routes.api.v1.reports.uptimeDaily,
	{
		summary: "Report daily uptime per monitor",
		description:
			"One row per monitor per UTC day with a roll-up row. `Accept: text/csv` downloads the whole range as CSV; JSON is the default and pages by cursor.",
		tags: TAGS,
		query: DAILY_REPORT_QUERY,
		responses: {
			200: {
				...DAILY_PAGE_RESPONSE,
				body: { "application/json": pageEnvelope(DAILY_PAGE), "text/csv": CSV_BODY },
				headers: { ...DAILY_PAGE_RESPONSE.headers, ...CSV_HEADERS },
			},
		},
		problems: [...FILTER_PROBLEMS, "badRequest", ...AUTH_PROBLEMS],
		security: [{ apiKey: ["reports:read"] }],
	},
);

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [REPORTS_UPTIME_SUMMARY, REPORTS_UPTIME_DAILY];
