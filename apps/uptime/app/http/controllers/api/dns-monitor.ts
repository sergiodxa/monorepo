/**
 * API v1 item endpoints for a single DNS monitor: get/update/delete
 * (`dns-monitors:read`/`dns-monitors:write`) and check-result history
 * (`dns-monitors:read`), scoped to a monitor owned by the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertDnsMonitor, SelectDnsMonitor } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { DNS_MONITOR_ID_PARAMS, UPDATE_DNS_MONITOR_BODY } from "~/app/http/openapi/dns-monitors";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, newestFirst, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { dnsMonitorRoutes } from "~/routes/api-groups";

/** Maps a DNS monitor row to its public camelCase JSON shape. */
function serializeDnsMonitor(monitor: SelectDnsMonitor) {
	return {
		id: encodeId("dns", monitor.id),
		name: monitor.name,
		domain: monitor.domain,
		zoneFileImportedAt: monitor.zone_file_imported_at,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		lastCheckedAt: monitor.last_checked_at,
		lastStatus: monitor.last_status,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

export default createController(dnsMonitorRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/dns-monitors/:dnsMonitorId — a single DNS monitor. */
		dnsMonitorShow: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
				let monitor = await DnsMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, dnsMonitorId);
				if (!monitor)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});
				return apiSuccess({ dnsMonitor: serializeDnsMonitor(monitor) });
			},
		},

		/** PUT /api/v1/dns-monitors/:dnsMonitorId — updates a DNS monitor's editable fields. */
		dnsMonitorUpdate: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
				let existing = await DnsMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, dnsMonitorId);
				if (!existing)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_DNS_MONITOR_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let changes: Partial<InsertDnsMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.domain !== undefined) changes.domain = result.data.domain;
				if (result.data.intervalSeconds !== undefined)
					changes.interval_seconds = result.data.intervalSeconds;
				if (result.data.isEnabled !== undefined) changes.is_enabled = result.data.isEnabled;

				let monitor = await DnsMonitor.updateById(ctx.db, dnsMonitorId, changes);
				return apiSuccess({ dnsMonitor: serializeDnsMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/dns-monitors/:dnsMonitorId — deletes a DNS monitor. */
		dnsMonitorDestroy: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
				let existing = await DnsMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, dnsMonitorId);
				if (!existing)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});

				await DnsMonitor.deleteById(ctx.db, dnsMonitorId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/dns-monitors/:dnsMonitorId/results — check-result history. */
		dnsMonitorResults: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
				let monitor = await DnsMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, dnsMonitorId);
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

				let page = await Pagination.byKeyset(DnsMonitor.resultsQuery(ctx.db, dnsMonitorId), {
					orderBy: newestFirst("checked_at"),
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

				let results = page.data.items.map((row) => ({
					id: encodeId("res", row.id),
					status: row.status,
					recordsChecked: row.records_checked,
					recordsChanged: row.records_changed,
					recordsMissing: row.records_missing,
					recordsNew: row.records_new,
					queriesFailed: row.queries_failed,
					responseTimeMs: row.response_time_ms,
					errorMessage: row.error_message,
					checkedAt: row.checked_at,
				}));

				return apiPage({ results }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
				});
			},
		},
	},
});
