/**
 * API v1 item endpoints for a single DNS monitor: get/update/delete
 * (`dns-monitors:read`/`dns-monitors:write`) and check-result history
 * (`dns-monitors:read`), scoped to a monitor owned by the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

import type { InsertDnsMonitor, SelectDnsMonitor } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	MAX_DNS_INTERVAL_SECONDS,
	MIN_DNS_INTERVAL_SECONDS,
} from "~/app/http/validators/dns-monitor";
import { apiError, apiSuccess, parsePaginationQuery } from "~/app/services/api-response";
import routes from "~/routes/web";

const DnsMonitorIdParams = s.object({ dnsMonitorId: s.string() });

/** Maps a DNS monitor row to its public camelCase JSON shape. */
function serializeDnsMonitor(monitor: SelectDnsMonitor) {
	return {
		id: monitor.id,
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

/**
 * `zoneFile` stays out of this schema: its text is never persisted, so re-importing runs as
 * its own action. `intervalSeconds` enforces the same floor and ceiling as monitor creation,
 * so an edited interval always stays one a fresh monitor could also be created with.
 */
const UpdateDnsMonitorSchema = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	domain: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	intervalSeconds: s.optional(
		s.number().pipe(checks.min(MIN_DNS_INTERVAL_SECONDS), checks.max(MAX_DNS_INTERVAL_SECONDS)),
	),
	isEnabled: s.optional(s.boolean()),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const dnsMonitorRoutes = {
	dnsMonitorShow: routes.api.v1.dnsMonitors.show,
	dnsMonitorUpdate: routes.api.v1.dnsMonitors.update,
	dnsMonitorDestroy: routes.api.v1.dnsMonitors.destroy,
	dnsMonitorResults: routes.api.v1.dnsMonitors.results,
};

export default createController(dnsMonitorRoutes, {
	actions: {
		/** GET /api/v1/dns-monitors/:dnsMonitorId — a single DNS monitor. */
		dnsMonitorShow: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DnsMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await DnsMonitor.findByIdForTeam(db, ctx.apiTeam.id, dnsMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "DNS monitor not found", NotFound);
				return apiSuccess({ dnsMonitor: serializeDnsMonitor(monitor) });
			},
		},

		/** PUT /api/v1/dns-monitors/:dnsMonitorId — updates a DNS monitor's editable fields. */
		dnsMonitorUpdate: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DnsMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await DnsMonitor.findByIdForTeam(db, ctx.apiTeam.id, dnsMonitorId);
				if (!existing) return apiError("NOT_FOUND", "DNS monitor not found", NotFound);

				let result = await validate(ctx.request, UpdateDnsMonitorSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let changes: Partial<InsertDnsMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.domain !== undefined) changes.domain = result.data.domain;
				if (result.data.intervalSeconds !== undefined)
					changes.interval_seconds = result.data.intervalSeconds;
				if (result.data.isEnabled !== undefined) changes.is_enabled = result.data.isEnabled;

				let monitor = await DnsMonitor.updateById(db, dnsMonitorId, changes);
				return apiSuccess({ dnsMonitor: serializeDnsMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/dns-monitors/:dnsMonitorId — deletes a DNS monitor. */
		dnsMonitorDestroy: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DnsMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await DnsMonitor.findByIdForTeam(db, ctx.apiTeam.id, dnsMonitorId);
				if (!existing) return apiError("NOT_FOUND", "DNS monitor not found", NotFound);

				await DnsMonitor.deleteById(db, dnsMonitorId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/dns-monitors/:dnsMonitorId/results — check-result history. */
		dnsMonitorResults: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DnsMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await DnsMonitor.findByIdForTeam(db, ctx.apiTeam.id, dnsMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "DNS monitor not found", NotFound);

				let { limit } = parsePaginationQuery(ctx.url, { defaultLimit: 50, maxLimit: 200 });
				let results = await DnsMonitor.listResults(db, dnsMonitorId, limit);

				return apiSuccess({
					results: results.map((row) => ({
						id: row.id,
						status: row.status,
						recordsChecked: row.records_checked,
						recordsChanged: row.records_changed,
						recordsMissing: row.records_missing,
						recordsNew: row.records_new,
						queriesFailed: row.queries_failed,
						responseTimeMs: row.response_time_ms,
						errorMessage: row.error_message,
						checkedAt: row.checked_at,
					})),
				});
			},
		},
	},
});
