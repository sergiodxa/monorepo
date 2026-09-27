/**
 * The DNS monitor operations of the API document: the collection, one monitor, its check
 * history and its tracked records. The request schemas here are the ones the controllers
 * validate with, so the published contract and the enforced one are the same values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import type { ZoneFileRejectionReason } from "~/app/services/zone-file";

import { envelope, PAGE_QUERY, pageResponse } from "~/app/http/openapi/envelope";
import { epochMs, resourceId } from "~/app/http/openapi/fields";
import {
	DEFAULT_DNS_INTERVAL_SECONDS,
	MAX_DNS_INTERVAL_SECONDS,
	MIN_DNS_INTERVAL_SECONDS,
} from "~/app/http/validators/dns-monitor";
import { typedId } from "~/app/services/typed-id";
import { dnsRecordStates } from "~/database/schema";
import routes from "~/routes/web";

const CHECK_STATUSES = ["ok", "changed", "error"] as const;
const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;
const DNS_RECORD_SOURCES = ["resolver", "zone_file"] as const;

/** Why a pasted zone-file line was left out of an import, as the parser reports it. */
const ZONE_FILE_REJECTION_REASONS = [
	"originDirective",
	"ttlDirective",
	"includeDirective",
	"generateDirective",
	"unsupportedDirective",
	"multiLineRecord",
	"blankOwnerContinuation",
	"nonInternetClass",
	"unsupportedType",
	"outOfZone",
	"malformed",
] as const satisfies readonly ZoneFileRejectionReason[];

/** The tag grouping every operation in this module. */
const TAGS = ["DNS monitors"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** A DNS monitor as `serializeDnsMonitor` writes it. */
const DNS_MONITOR = s
	.object({
		id: resourceId("dns"),
		name: s.string(),
		domain: s.string(),
		zoneFileImportedAt: s.nullable(epochMs()).meta({
			description: "When a zone file was last imported; null if only the apex is covered",
		}),
		intervalSeconds: s.integer(),
		isEnabled: s.boolean(),
		lastCheckedAt: s.nullable(epochMs()),
		lastStatus: s.nullable(s.enum_(CHECK_STATUSES)),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "DnsMonitor" });

/** What the discovery a create runs inline found; the pasted zone text itself never returns. */
const DNS_DISCOVERY = s
	.object({
		names: s.integer().meta({ description: "Names swept: the apex plus every zone-file name" }),
		recordsImported: s.integer(),
		queriesFailed: s.integer().meta({ description: "Queries that did not answer" }),
		rejectedLines: s.array(
			s.object({ line: s.integer(), reason: s.enum_(ZONE_FILE_REJECTION_REASONS) }),
		),
		duplicateLines: s.array(s.integer()).meta({
			description: "Lines repeating a record an earlier line declared",
		}),
	})
	.meta({ id: "DnsDiscovery" });

/** One check of a DNS monitor, summarized as counters over every record it swept. */
const DNS_MONITOR_RESULT = s
	.object({
		id: resourceId("res"),
		status: s.enum_(CHECK_STATUSES),
		recordsChecked: s.integer(),
		recordsChanged: s.integer(),
		recordsMissing: s.integer(),
		recordsNew: s.integer(),
		queriesFailed: s.integer(),
		responseTimeMs: s.nullable(s.integer()).meta({ description: "The slowest single query" }),
		errorMessage: s.nullable(s.string()),
		checkedAt: epochMs(),
	})
	.meta({ id: "DnsMonitorResult" });

/** A tracked record as `serializeDnsMonitorRecord` writes it. */
const DNS_MONITOR_RECORD = s
	.object({
		id: resourceId("dnsrec"),
		dnsMonitorId: resourceId("dns"),
		name: s.string(),
		recordType: s.enum_(DNS_RECORD_TYPES),
		value: s.string(),
		source: s.enum_(DNS_RECORD_SOURCES),
		isEnabled: s.boolean().meta({ description: "Whether a deviation from this record alerts" }),
		status: s.enum_(dnsRecordStates),
		firstSeenAt: epochMs(),
		lastSeenAt: s.nullable(epochMs()).meta({
			description: "Last check that resolved this record; null for zone-file-only records",
		}),
		lastCheckedAt: s.nullable(epochMs()),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "DnsMonitorRecord" });

/** The path params naming one DNS monitor. */
export const DNS_MONITOR_ID_PARAMS = s.object({ dnsMonitorId: typedId("dns") });

/** The path params naming one tracked record on one DNS monitor. */
export const DNS_MONITOR_RECORD_PARAMS = s.object({
	dnsMonitorId: typedId("dns"),
	recordId: typedId("dnsrec"),
});

/** The interval a DNS monitor may be checked at, the same bounds on create and update. */
function dnsInterval() {
	return s
		.number()
		.pipe(checks.min(MIN_DNS_INTERVAL_SECONDS), checks.max(MAX_DNS_INTERVAL_SECONDS));
}

/** The body `POST /api/v1/dns-monitors` accepts; omitted fields take their defaults. */
export const CREATE_DNS_MONITOR_BODY = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	domain: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	zoneFile: s.optional(
		s.string().meta({
			description: "A BIND zone file, parsed once; only the records it declares persist",
		}),
	),
	intervalSeconds: s.defaulted(dnsInterval(), DEFAULT_DNS_INTERVAL_SECONDS),
	isEnabled: s.defaulted(s.boolean(), true),
});

/**
 * The body `PUT /api/v1/dns-monitors/{dnsMonitorId}` accepts; every field is optional. A
 * zone file is re-imported through its own action, since its text is never persisted.
 */
export const UPDATE_DNS_MONITOR_BODY = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	domain: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	intervalSeconds: s.optional(dnsInterval()),
	isEnabled: s.optional(s.boolean()),
});

/**
 * The record's enable/decline decision, and nothing else: any other key is refused, since
 * `name`/`recordType`/`value` identify the record, and `isEnabled` is required so every
 * accepted body expresses one decision.
 */
export const UPDATE_DNS_MONITOR_RECORD_BODY = s.object(
	{ isEnabled: s.boolean() },
	{ unknownKeys: "error" },
);

const DNS_MONITORS_INDEX = defineOperation("dnsMonitorsIndex", routes.api.v1.dnsMonitors.index, {
	summary: "List DNS monitors",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the team's DNS monitors, newest first", {
			dnsMonitors: s.array(DNS_MONITOR),
		}),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["dns-monitors:read"] }],
});

const DNS_MONITORS_CREATE = defineOperation("dnsMonitorsCreate", routes.api.v1.dnsMonitors.create, {
	summary: "Create a DNS monitor",
	tags: TAGS,
	body: CREATE_DNS_MONITOR_BODY,
	responses: {
		201: {
			description: "The created monitor and what discovery imported",
			body: envelope({ dnsMonitor: DNS_MONITOR, discovery: DNS_DISCOVERY }),
		},
	},
	problems: ["validationError", "limitExceeded", ...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS],
	security: [{ apiKey: ["dns-monitors:write"] }],
});

const DNS_MONITOR_SHOW = defineOperation("dnsMonitorShow", routes.api.v1.dnsMonitors.show, {
	summary: "Show a DNS monitor",
	tags: TAGS,
	params: DNS_MONITOR_ID_PARAMS,
	responses: { 200: { description: "The monitor", body: envelope({ dnsMonitor: DNS_MONITOR }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["dns-monitors:read"] }],
});

const DNS_MONITOR_UPDATE = defineOperation("dnsMonitorUpdate", routes.api.v1.dnsMonitors.update, {
	summary: "Update a DNS monitor",
	tags: TAGS,
	params: DNS_MONITOR_ID_PARAMS,
	body: UPDATE_DNS_MONITOR_BODY,
	responses: {
		200: { description: "The updated monitor", body: envelope({ dnsMonitor: DNS_MONITOR }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["dns-monitors:write"] }],
});

const DNS_MONITOR_DESTROY = defineOperation(
	"dnsMonitorDestroy",
	routes.api.v1.dnsMonitors.destroy,
	{
		summary: "Delete a DNS monitor",
		tags: TAGS,
		params: DNS_MONITOR_ID_PARAMS,
		responses: {
			200: { description: "The monitor is deleted", body: envelope({ deleted: s.literal(true) }) },
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["dns-monitors:write"] }],
	},
);

const DNS_MONITOR_RESULTS = defineOperation(
	"dnsMonitorResults",
	routes.api.v1.dnsMonitors.results,
	{
		summary: "List a DNS monitor's check results",
		tags: TAGS,
		params: DNS_MONITOR_ID_PARAMS,
		query: PAGE_QUERY,
		responses: {
			200: pageResponse("A page of check results, newest first", {
				results: s.array(DNS_MONITOR_RESULT),
			}),
		},
		problems: ["validationError", "badRequest", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["dns-monitors:read"] }],
	},
);

const DNS_MONITOR_RECORDS_INDEX = defineOperation(
	"dnsMonitorRecordsIndex",
	routes.api.v1.dnsMonitors.records.index,
	{
		summary: "List a DNS monitor's tracked records",
		tags: TAGS,
		params: DNS_MONITOR_ID_PARAMS,
		query: PAGE_QUERY,
		responses: {
			200: pageResponse("A page of tracked records, by name, type and value", {
				records: s.array(DNS_MONITOR_RECORD),
			}),
		},
		problems: ["validationError", "badRequest", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["dns-monitors:read"] }],
	},
);

const DNS_MONITOR_RECORD_UPDATE = defineOperation(
	"dnsMonitorRecordUpdate",
	routes.api.v1.dnsMonitors.records.update,
	{
		summary: "Enable or decline a tracked DNS record",
		tags: TAGS,
		params: DNS_MONITOR_RECORD_PARAMS,
		body: UPDATE_DNS_MONITOR_RECORD_BODY,
		responses: {
			200: { description: "The updated record", body: envelope({ record: DNS_MONITOR_RECORD }) },
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["dns-monitors:write"] }],
	},
);

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	DNS_MONITORS_INDEX,
	DNS_MONITORS_CREATE,
	DNS_MONITOR_SHOW,
	DNS_MONITOR_UPDATE,
	DNS_MONITOR_DESTROY,
	DNS_MONITOR_RESULTS,
	DNS_MONITOR_RECORDS_INDEX,
	DNS_MONITOR_RECORD_UPDATE,
];
