/**
 * API v1 sub-resource for a DNS monitor's tracked records: list them, and toggle whether a
 * deviation from one alerts. Both leaves ride the existing
 * `dns-monitors:read`/`dns-monitors:write` scopes rather than a pair of their own, because a
 * key that may reconfigure a domain monitor may decide which of its records are watched.
 *
 * This is the only channel a script has for declining a record: an API-created monitor
 * imports and enables everything discovery found, since there is no human standing there to
 * review it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { and, Database, eq } from "remix/data-table";
import { createController } from "remix/router";

import type { SelectDnsMonitorRecord } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { dnsMonitorRecords } from "~/database/schema";
import routes from "~/routes/web";

const DnsMonitorIdParams = s.object({ dnsMonitorId: s.string() });
const DnsMonitorRecordParams = s.object({ dnsMonitorId: s.string(), recordId: s.string() });

/**
 * The record's enable/decline decision, and nothing else.
 *
 * `unknownKeys: "error"` rather than the default strip, which is the load-bearing choice
 * here: `(name, recordType, value)` are the record's identity and the key the diff runs on,
 * so a caller that sends one is asking to retarget the expectation rather than to change it.
 * Stripping would accept that request, answer `200`, and silently do nothing — the caller
 * would go on believing it had edited the record. Refusing says what actually happened.
 *
 * `isEnabled` is required rather than optional for the same reason: a `PATCH` with nothing
 * writable in it expresses no decision, and answering `200` to it would claim one was made.
 */
const UpdateDnsMonitorRecordSchema = s.object({ isEnabled: s.boolean() }, { unknownKeys: "error" });

/** Maps a tracked-record row to its public camelCase JSON shape. */
function serializeDnsMonitorRecord(record: SelectDnsMonitorRecord) {
	return {
		id: record.id,
		dnsMonitorId: record.dns_monitor_id,
		name: record.name,
		recordType: record.record_type,
		value: record.value,
		source: record.source,
		isEnabled: record.is_enabled,
		status: record.status,
		firstSeenAt: record.first_seen_at,
		lastSeenAt: record.last_seen_at,
		lastCheckedAt: record.last_checked_at,
		createdAt: record.created_at,
		updatedAt: record.updated_at,
	};
}

/**
 * Joins a validation failure into one message, naming the offending field where the schema
 * reported a path. Both messages this endpoint can produce — "Unknown key" for an identity
 * field and a type mismatch on `isEnabled` — are useless without the field name attached.
 */
function validationMessage(issues: readonly { message: string; path?: readonly unknown[] }[]) {
	return issues
		.map((issue) => {
			let path = (issue.path ?? [])
				.map((segment) =>
					typeof segment === "object" && segment !== null && "key" in segment
						? String((segment as { key: unknown }).key)
						: String(segment),
				)
				.join(".");

			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join(", ");
}

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const dnsMonitorRecordsRoutes = {
	dnsMonitorRecordsIndex: routes.api.v1.dnsMonitors.records.index,
	dnsMonitorRecordUpdate: routes.api.v1.dnsMonitors.records.update,
};

export default createController(dnsMonitorRecordsRoutes, {
	actions: {
		/**
		 * GET /api/v1/dns-monitors/:dnsMonitorId/records — the monitor's tracked records.
		 *
		 * Unpaginated, like the other sub-resource lists: the set is a monitor's configuration
		 * rather than history, it is bounded by the names an import found, and a caller
		 * deciding which records to decline needs all of them to decide against.
		 */
		dnsMonitorRecordsIndex: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DnsMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);

				// Scoped to the caller's team, and a miss is 404 rather than 403: answering 403
				// would confirm the id names a real monitor belonging to somebody else.
				let monitor = await DnsMonitor.findByIdForTeam(db, ctx.apiTeam.id, dnsMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "DNS monitor not found", NotFound);

				let records = await DnsMonitorRecord.listByMonitor(db, dnsMonitorId);
				return apiSuccess({ records: records.map(serializeDnsMonitorRecord) });
			},
		},

		/**
		 * PATCH /api/v1/dns-monitors/:dnsMonitorId/records/:recordId — enables or declines one
		 * record. Enabling one discovery reported as `new` also settles it to `ok`, which is
		 * `DnsMonitorRecord.setEnabled`'s job, so the row is re-read before serializing rather
		 * than patched in memory.
		 */
		dnsMonitorRecordUpdate: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let { dnsMonitorId, recordId } = s.parse(DnsMonitorRecordParams, ctx.params);
				let db = getServiceContainer().get(Database);

				let monitor = await DnsMonitor.findByIdForTeam(db, ctx.apiTeam.id, dnsMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "DNS monitor not found", NotFound);

				// Both existence checks run before the body is read, so a record id that names
				// nothing answers 404 rather than a 400 about a body nobody will ever apply.
				let existing = await findRecordForMonitor(db, dnsMonitorId, recordId);
				if (!existing) return apiError("NOT_FOUND", "DNS record not found", NotFound);

				let result = await validate(ctx.request, UpdateDnsMonitorRecordSchema);
				if (isFailure(result)) {
					return apiError("VALIDATION_ERROR", validationMessage(result.error.issues), BadRequest);
				}

				await DnsMonitorRecord.setEnabled(db, dnsMonitorId, [recordId], result.data.isEnabled);

				let record = await findRecordForMonitor(db, dnsMonitorId, recordId);
				if (!record) return apiError("NOT_FOUND", "DNS record not found", NotFound);

				return apiSuccess({ record: serializeDnsMonitorRecord(record) });
			},
		},
	},
});

/**
 * One record, scoped to its monitor, so an id belonging to another monitor — and therefore
 * possibly to another team — matches nothing instead of being addressable through a monitor
 * the caller does own.
 */
async function findRecordForMonitor(db: Database, monitorId: string, recordId: string) {
	return await db.findOne(dnsMonitorRecords, {
		where: and(eq("id", recordId), eq("dns_monitor_id", monitorId)),
	});
}
