/**
 * API v1 collection endpoints for DNS monitors: `GET /api/v1/dns-monitors` lists a
 * team's DNS monitors and `POST /api/v1/dns-monitors` creates one. Requires
 * `dns-monitors:read`/`dns-monitors:write` via `requireApiKey`.
 *
 * A create optionally carries a zone file, and runs discovery inline: there is no reviewer
 * on an API call, so everything discovered is imported **and watched**, and the records
 * sub-resource is how a script turns off what it did not want. The lines the parser could
 * not use come back in the response rather than being dropped, since a script has no review
 * screen to read them off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created } from "@pkg/http/status-code";
import { logger } from "@pkg/logger";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { ZoneFileImport } from "~/app/services/zone-file";
import type { SelectDnsMonitor } from "~/database/schema";

import DnsMonitor, { MAX_DNS_MONITORS_PER_TEAM } from "~/app/data/dns-monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	DEFAULT_DNS_INTERVAL_SECONDS,
	MAX_DNS_INTERVAL_SECONDS,
	MIN_DNS_INTERVAL_SECONDS,
} from "~/app/http/validators/dns-monitor";
import { apiError, apiSuccess } from "~/app/services/api-response";
import {
	MAX_TRACKED_NAMES_PER_MONITOR,
	discoveryNames,
	importDiscovery,
} from "~/app/services/dns-discovery";
import { MAX_ZONE_FILE_BYTES, parseZoneFile } from "~/app/services/zone-file";
import routes from "~/routes/web";

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

const CreateDnsMonitorSchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	domain: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	/** Read once, parsed, and discarded — the API stores the records, never the text. */
	zoneFile: s.optional(s.string()),
	intervalSeconds: s.defaulted(
		s.number().pipe(checks.min(MIN_DNS_INTERVAL_SECONDS), checks.max(MAX_DNS_INTERVAL_SECONDS)),
		DEFAULT_DNS_INTERVAL_SECONDS,
	),
	isEnabled: s.defaulted(s.boolean(), true),
});

/** What a parsed paste amounts to here: the records it declared and the lines it did not. */
type ZoneFileParse = ZoneFileImport;

/**
 * What discovery found, reported back on a create.
 *
 * The rejected lines are here because this is the only channel a script has: the web flow
 * shows them above the review list, and an API caller that pasted a zone with `$ORIGIN` in it
 * would otherwise be told nothing and end up monitoring a subset of what it thinks it is.
 * Only the line number and the reason travel — never the line's text, which is a copy of
 * somebody's zone and is not this response's business.
 */
function serializeDiscovery(
	names: string[],
	imported: number,
	queriesFailed: number,
	zoneFile: ZoneFileParse | null,
) {
	return {
		names: names.length,
		recordsImported: imported,
		queriesFailed,
		rejectedLines:
			zoneFile?.rejected.map((rejection) => ({
				line: rejection.line,
				reason: rejection.reason,
			})) ?? [],
		duplicateLines: zoneFile?.duplicates.map((duplicate) => duplicate.line) ?? [],
	};
}

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const dnsMonitorsRoutes = {
	dnsMonitorsIndex: routes.api.v1.dnsMonitors.index,
	dnsMonitorsCreate: routes.api.v1.dnsMonitors.create,
};

export default createController(dnsMonitorsRoutes, {
	actions: {
		/** GET /api/v1/dns-monitors — lists the team's DNS monitors. */
		dnsMonitorsIndex: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let dnsMonitors = await DnsMonitor.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ dnsMonitors: dnsMonitors.map(serializeDnsMonitor) });
			},
		},

		/** POST /api/v1/dns-monitors — creates a DNS monitor for the team, up to {@link MAX_DNS_MONITORS_PER_TEAM}. */
		dnsMonitorsCreate: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);

				/**
				 * Checked before anything is parsed or resolved: one check sweeps every tracked
				 * name of every monitor a team owns, so an unbounded collection is a cost and
				 * platform-limit problem rather than an untidy one. Same cap the web create flow
				 * applies, so a key cannot be used to walk around it.
				 */
				let existingCount = await DnsMonitor.countByTeam(db, ctx.apiTeam.id);
				if (existingCount >= MAX_DNS_MONITORS_PER_TEAM) {
					return apiError(
						"LIMIT_EXCEEDED",
						`Maximum of ${MAX_DNS_MONITORS_PER_TEAM} DNS monitors per team`,
						BadRequest,
					);
				}

				let result = await validate(ctx.request, CreateDnsMonitorSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let zoneFile: ZoneFileParse | null = null;

				if (result.data.zoneFile !== undefined && result.data.zoneFile.trim() !== "") {
					let parsed = parseZoneFile(result.data.zoneFile, result.data.domain);
					if (isFailure(parsed)) {
						return apiError(
							"VALIDATION_ERROR",
							`zoneFile must be ${MAX_ZONE_FILE_BYTES} bytes or smaller`,
							BadRequest,
						);
					}
					zoneFile = parsed.data;
				}

				let names = discoveryNames(result.data.domain, zoneFile?.records ?? []);
				/**
				 * Refused rather than truncated, and before the monitor row exists: a check
				 * sweeps every tracked name inside one invocation, so a zone with more names
				 * than that budget covers has to be split across monitors — and a caller told
				 * "created" while half its zone was dropped would be monitoring less than it
				 * believes it is.
				 */
				if (names.length > MAX_TRACKED_NAMES_PER_MONITOR) {
					return apiError(
						"VALIDATION_ERROR",
						`zoneFile declares ${names.length} names, over the ${MAX_TRACKED_NAMES_PER_MONITOR} name limit for one monitor`,
						BadRequest,
					);
				}

				let dnsMonitor = await DnsMonitor.create(db, ctx.apiTeam.id, {
					name: result.data.name,
					domain: result.data.domain,
					zone_file_imported_at: zoneFile === null ? null : Date.now(),
					interval_seconds: result.data.intervalSeconds,
					is_enabled: result.data.isEnabled,
				});

				/**
				 * Awaited, so the response describes a monitor whose records exist: a script
				 * that creates one and immediately lists its records must not be handed an empty
				 * list. A resolver that could not be reached still leaves a usable monitor — the
				 * next scheduled check discovers the same records — so it is reported through
				 * `queriesFailed` rather than failing the create.
				 */
				let imported = 0;
				let queriesFailed = 0;
				try {
					let discovery = await importDiscovery(db, dnsMonitor.id, names, zoneFile?.records ?? []);
					imported = discovery.imported;
					queriesFailed = discovery.queriesFailed;
				} catch (error) {
					logger.error("api.dns_monitors.discovery_failed", {
						monitorId: dnsMonitor.id,
						error: error instanceof Error ? error.message : String(error),
					});
				}

				return apiSuccess(
					{
						dnsMonitor: serializeDnsMonitor(dnsMonitor),
						discovery: serializeDiscovery(names, imported, queriesFailed, zoneFile),
					},
					Created,
				);
			},
		},
	},
});
