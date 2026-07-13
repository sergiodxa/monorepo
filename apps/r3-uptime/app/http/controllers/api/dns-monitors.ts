/**
 * API v1 collection endpoints for DNS monitors: `GET /api/v1/dns-monitors` lists a
 * team's DNS monitors and `POST /api/v1/dns-monitors` creates one. Requires
 * `dns-monitors:read`/`dns-monitors:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { SelectDnsMonitor } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;

/** Maps a DNS monitor row to the OLD APP's exact camelCase JSON shape. */
function serializeDnsMonitor(monitor: SelectDnsMonitor) {
	return {
		id: monitor.id,
		name: monitor.name,
		domain: monitor.domain,
		recordType: monitor.record_type,
		expectedValue: monitor.expected_value,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		lastCheckedAt: monitor.last_checked_at,
		lastStatus: monitor.last_status,
		lastValue: monitor.last_value,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

const CreateDnsMonitorSchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	domain: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	recordType: s.enum_(DNS_RECORD_TYPES),
	expectedValue: s.optional(s.string().pipe(checks.maxLength(1024))),
	intervalSeconds: s.defaulted(s.number().pipe(checks.min(60), checks.max(86_400)), 3600),
	isEnabled: s.defaulted(s.boolean(), true),
});

/** GET /api/v1/dns-monitors — lists the team's DNS monitors. */
export const dnsMonitorsIndex = createAction(routes.api.v1.dnsMonitorsIndex, {
	middleware: [requireApiKey("dns-monitors:read")],
	handler: async (ctx) => {
		let db = getServiceContainer().get(Database);
		let dnsMonitors = await DnsMonitor.listByTeam(db, ctx.apiTeam.id);
		return apiSuccess({ dnsMonitors: dnsMonitors.map(serializeDnsMonitor) });
	},
});

/** POST /api/v1/dns-monitors — creates a DNS monitor for the team. */
export const dnsMonitorsCreate = createAction(routes.api.v1.dnsMonitorsCreate, {
	middleware: [requireApiKey("dns-monitors:write")],
	handler: async (ctx) => {
		let result = await validate(ctx.request, CreateDnsMonitorSchema);
		if (isFailure(result)) {
			return apiError(
				"VALIDATION_ERROR",
				result.error.issues.map((issue) => issue.message).join(", "),
				BadRequest,
			);
		}

		let db = getServiceContainer().get(Database);
		let dnsMonitor = await DnsMonitor.create(db, ctx.apiTeam.id, {
			name: result.data.name,
			domain: result.data.domain,
			record_type: result.data.recordType,
			expected_value: result.data.expectedValue ?? null,
			interval_seconds: result.data.intervalSeconds,
			is_enabled: result.data.isEnabled,
		});

		return apiSuccess({ dnsMonitor: serializeDnsMonitor(dnsMonitor) }, Created);
	},
});
