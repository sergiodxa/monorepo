/**
 * API v1 collection endpoints for DNS monitors: `GET /api/v1/dns-monitors` lists a team's
 * monitors and `POST /api/v1/dns-monitors` creates one, gated by `dns-monitors:read`/`write`
 * via `requireApiKey`. A create can carry a zone file and runs discovery inline, since no
 * reviewer sits between an API call and the monitor, so everything discovered is imported
 * **and watched**; rejected lines come back in the response since a script has no review screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Created } from "@sdxc/http/status-code";
import { currentLog } from "@sdxc/logger";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { ZoneFileImport } from "~/app/services/zone-file";
import type { SelectDnsMonitor } from "~/database/schema";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import idempotent from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { CREATE_DNS_MONITOR_BODY } from "~/app/http/openapi/dns-monitors";
import { MAX_DNS_MONITORS_PER_TEAM } from "~/app/models/dns-monitors";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import {
	MAX_TRACKED_NAMES_PER_MONITOR,
	discoveryNames,
	importDiscovery,
} from "~/app/services/dns-discovery";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { MAX_ZONE_FILE_BYTES, parseZoneFile } from "~/app/services/zone-file";
import { dnsMonitorsRoutes } from "~/routes/api-groups";

/**
 * Maps a DNS monitor row to its public camelCase JSON shape, the one every DNS monitor
 * endpoint answers with. The registration members read as the last lookup left them; the
 * EPP statuses are the last successful lookup's, so they stand while a lookup is failing.
 */
export function serializeDnsMonitor(monitor: SelectDnsMonitor) {
	return {
		id: encodeId("dns", monitor.id),
		name: monitor.name,
		domain: monitor.domain,
		zoneFileImportedAt: monitor.zone_file_imported_at,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		lastCheckedAt: monitor.last_checked_at,
		lastStatus: monitor.last_status,
		registrationStatus: monitor.registration_status,
		registrationExpiresAt: monitor.registration_expires_at,
		registrar: monitor.registrar,
		registrationEppStatuses: monitor.registration_epp_statuses ?? [],
		registrationWarningDays: monitor.registration_warning_days,
		registrationCheckedAt: monitor.registration_checked_at,
		registrationError: monitor.registration_error,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

/** What a parsed paste amounts to here: the records it declared and the lines it rejected. */
type ZoneFileParse = ZoneFileImport;

/**
 * What discovery found, reported back on a create. Rejected lines travel here since a
 * script has no review screen to read them off — only the line number and reason travel,
 * while the zone text stays with the caller who pasted it.
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

export default createController(dnsMonitorsRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/dns-monitors — a page of the team's DNS monitors, newest first. */
		dnsMonitorsIndex: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = ctx.models.dnsMonitors.inTeam(ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
					orderBy: NEWEST_FIRST,
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

				return apiPage({ dnsMonitors: page.data.items.map(serializeDnsMonitor) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/** POST /api/v1/dns-monitors — creates a DNS monitor for the team, up to {@link MAX_DNS_MONITORS_PER_TEAM}. */
		dnsMonitorsCreate: {
			middleware: [requireApiKey("dns-monitors:write"), idempotent],
			handler: async (ctx) => {
				/**
				 * Checked before anything is parsed: one check sweeps every tracked name of every monitor
				 * a team owns, so an unbounded collection is a cost problem before it is an untidy one, and
				 * a key cannot use this endpoint to walk around the web flow's cap.
				 */
				let existingCount = await ctx.models.dnsMonitors.inTeam(ctx.apiTeam.id).count();
				if (existingCount >= MAX_DNS_MONITORS_PER_TEAM) {
					return apiProblems.limitExceeded({
						detail: `Maximum of ${MAX_DNS_MONITORS_PER_TEAM} DNS monitors per team`,
						instance: problemInstance(),
					});
				}

				let result = await validate(ctx.request, CREATE_DNS_MONITOR_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let zoneFile: ZoneFileParse | null = null;

				if (result.data.zoneFile !== undefined && result.data.zoneFile.trim() !== "") {
					let parsed = parseZoneFile(result.data.zoneFile, result.data.domain);
					if (isFailure(parsed)) {
						return invalidField(
							`zoneFile must be ${MAX_ZONE_FILE_BYTES} bytes or smaller`,
							"/zoneFile",
						);
					}
					zoneFile = parsed.data;
				}

				let names = discoveryNames(result.data.domain, zoneFile?.records ?? []);
				/**
				 * Refused before the monitor row exists, since the invocation-wide check sweeps every
				 * tracked name once: a zone over the limit is split across monitors, and the caller sees an
				 * accurate count of what actually got tracked.
				 */
				if (names.length > MAX_TRACKED_NAMES_PER_MONITOR) {
					return invalidField(
						`zoneFile declares ${names.length} names, over the ${MAX_TRACKED_NAMES_PER_MONITOR} name limit for one monitor`,
						"/zoneFile",
					);
				}

				let dnsMonitor = unwrap(
					await ctx.models.dnsMonitors.create({
						team_id: ctx.apiTeam.id,
						name: result.data.name,
						domain: result.data.domain,
						zone_file_imported_at: zoneFile === null ? null : Date.now(),
						interval_seconds: result.data.intervalSeconds,
						is_enabled: result.data.isEnabled,
						registration_warning_days: result.data.registrationWarningDays,
					}),
				);

				/**
				 * Awaited, so the response reflects a monitor whose records already exist, since a script
				 * that lists immediately after creating must see them. An unreachable resolver still leaves
				 * a usable monitor for the next scheduled check to discover, reported here through `queriesFailed`.
				 */
				let imported = 0;
				let queriesFailed = 0;
				try {
					let discovery = await importDiscovery(
						ctx.db,
						dnsMonitor.id,
						names,
						zoneFile?.records ?? [],
					);
					imported = discovery.imported;
					queriesFailed = discovery.queriesFailed;
				} catch (error) {
					currentLog()
						?.set({ monitor: { id: dnsMonitor.id, type: "dns" } })
						.warn("dns.discovery_failed", {
							message: error instanceof Error ? error.message : String(error),
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
