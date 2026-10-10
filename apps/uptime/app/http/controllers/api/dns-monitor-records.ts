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

import type { OrderByTuple } from "@sdxc/pagination";
import type { Database } from "remix/data-table";

import * as s from "@sdxc/json-schema";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { and, eq } from "remix/data-table";
import { createController } from "remix/router";

import type { SelectDnsMonitorRecord } from "~/database/schema";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	DNS_MONITOR_ID_PARAMS,
	DNS_MONITOR_RECORD_PARAMS,
	UPDATE_DNS_MONITOR_RECORD_BODY,
} from "~/app/http/openapi/dns-monitors";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { dnsMonitorRecords } from "~/database/schema";
import { dnsMonitorRecordsRoutes } from "~/routes/api-groups";

/**
 * The alphabetical walk this list has always served, since a caller reads it to decide
 * which records to decline and reads it by name rather than by age. `id` closes the
 * ordering, giving the seek the unique key a cursor needs.
 */
const BY_RECORD_IDENTITY: readonly OrderByTuple[] = [
	["name", "asc"],
	["record_type", "asc"],
	["value", "asc"],
	["id", "asc"],
];

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

export default createController(dnsMonitorRecordsRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/**
		 * GET /api/v1/dns-monitors/:dnsMonitorId/records — a page of the monitor's tracked
		 * records, walked by following the `Link` header. A monitor scoped to another team
		 * draws the same 404 as one that doesn't exist, keeping both indistinguishable.
		 */
		dnsMonitorRecordsIndex: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);

				let monitor = await ctx.models.dnsMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: dnsMonitorId })
					.first();
				if (!monitor)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = ctx.models.dnsMonitorRecords.forMonitor(dnsMonitorId);

				let page = await Pagination.byKeyset(query, {
					orderBy: BY_RECORD_IDENTITY,
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiProblems.badRequest({
							detail: page.error.message,
							instance: problemInstance(),
						});
					}
					return apiProblems.internal({ detail: page.error.message, instance: problemInstance() });
				}

				return apiPage({ records: page.data.items.map(serializeDnsMonitorRecord) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
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
				let { dnsMonitorId, recordId } = s.parse(DNS_MONITOR_RECORD_PARAMS, ctx.params);

				let monitor = await ctx.models.dnsMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: dnsMonitorId })
					.first();
				if (!monitor)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});

				let existing = await findRecordForMonitor(ctx.db, dnsMonitorId, recordId);
				if (!existing)
					return apiProblems.notFound({
						detail: "DNS record not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_DNS_MONITOR_RECORD_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error.issues) },
					});
				}

				await ctx.models.dnsMonitorRecords.setEnabled(
					dnsMonitorId,
					[recordId],
					result.data.isEnabled,
				);

				let record = await findRecordForMonitor(ctx.db, dnsMonitorId, recordId);
				if (!record)
					return apiProblems.notFound({
						detail: "DNS record not found",
						instance: problemInstance(),
					});

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
