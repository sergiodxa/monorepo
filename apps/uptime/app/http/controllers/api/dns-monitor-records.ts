/**
 * API v1 sub-resource for a DNS monitor's tracked records: lists them and toggles whether a
 * deviation from one alerts. Rides the existing `dns-monitors:read`/`write` scopes rather
 * than a pair of their own, since a key that can reconfigure a domain monitor can already
 * decide which of its records are watched. The update leaf is the only channel a script has
 * for declining a record, since an API-created monitor imports and enables everything discovery found.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, NotFound } from "@sdxc/http/status-code";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { and, Database, eq } from "remix/data-table";
import { createController } from "remix/router";

import type { SelectDnsMonitorRecord } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { encodeId, typedId } from "~/app/services/typed-id";
import { dnsMonitorRecords } from "~/database/schema";
import routes from "~/routes/web";

const DnsMonitorIdParams = s.object({ dnsMonitorId: typedId("dns") });
const DnsMonitorRecordParams = s.object({
	dnsMonitorId: typedId("dns"),
	recordId: typedId("dnsrec"),
});

/**
 * The record's enable/decline decision, and nothing else. `unknownKeys: "error"` rejects a
 * body that also sends `name`/`recordType`/`value`, since those identify the record rather
 * than change it; `isEnabled` is required so every accepted body expresses one decision.
 */
const UpdateDnsMonitorRecordSchema = s.object({ isEnabled: s.boolean() }, { unknownKeys: "error" });

/** Maps a tracked-record row to its public camelCase JSON shape. */
function serializeDnsMonitorRecord(record: SelectDnsMonitorRecord) {
	return {
		id: encodeId("dnsrec", record.id),
		dnsMonitorId: encodeId("dns", record.dns_monitor_id),
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
	middleware: [catchValidationError()],
	actions: {
		/**
		 * GET /api/v1/dns-monitors/:dnsMonitorId/records — the monitor's tracked records,
		 * unpaginated since a caller declining records needs the whole list. A monitor scoped
		 * to another team draws the same 404 as one that doesn't exist, keeping both indistinguishable.
		 */
		dnsMonitorRecordsIndex: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DnsMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);

				let monitor = await DnsMonitor.findByIdForTeam(db, ctx.apiTeam.id, dnsMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "DNS monitor not found", NotFound);

				let records = await DnsMonitorRecord.listByMonitor(db, dnsMonitorId);
				return apiSuccess({ records: records.map(serializeDnsMonitorRecord) });
			},
		},

		/**
		 * PATCH /api/v1/dns-monitors/:dnsMonitorId/records/:recordId — enables or declines one record,
		 * checking existence before reading the body so an unmatched id 404s. Re-reads the row after
		 * `setEnabled`, which may settle a `new` discovery to `ok`.
		 */
		dnsMonitorRecordUpdate: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let { dnsMonitorId, recordId } = s.parse(DnsMonitorRecordParams, ctx.params);
				let db = getServiceContainer().get(Database);

				let monitor = await DnsMonitor.findByIdForTeam(db, ctx.apiTeam.id, dnsMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "DNS monitor not found", NotFound);

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
 * possibly to another team — resolves only when looked up through the monitor that actually
 * owns it.
 */
async function findRecordForMonitor(db: Database, monitorId: string, recordId: string) {
	return await db.findOne(dnsMonitorRecords, {
		where: and(eq("id", recordId), eq("dns_monitor_id", monitorId)),
	});
}
