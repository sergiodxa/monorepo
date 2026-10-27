/**
 * Answers `create_dns_monitor`: creates a DNS monitor and optionally imports records from
 * a zone-file paste, reporting what discovery tracked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";
import { createTool, ToolError } from "@sdxc/mcp";
import { isFailure, unwrap } from "@sdxc/result";

import type { ZoneFileImport } from "~/app/services/zone-file";

import { forAbility } from "~/app/mcp/ability";
import { serializeDnsMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import { MAX_DNS_MONITORS_PER_TEAM } from "~/app/models/dns-monitors";
import abilities from "~/app/policies/abilities";
import {
	MAX_TRACKED_NAMES_PER_MONITOR,
	discoveryNames,
	importDiscovery,
} from "~/app/services/dns/discovery";
import { MAX_ZONE_FILE_BYTES, parseZoneFile } from "~/app/services/zone-file";

/** What discovery found, reported back on a create. */
function serializeDiscovery(
	names: string[],
	imported: number,
	queriesFailed: number,
	zoneFile: ZoneFileImport | null,
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

/** Creates a DNS monitor, optionally importing a zone file into tracked records. */
export default createTool(toolset.createDnsMonitor, {
	...forAbility(abilities.dnsMonitors.write),
	handler: async (ctx) => {
		let existingCount = await ctx.models.dnsMonitors.inTeam(ctx.apiTeam.id).count();
		if (existingCount >= MAX_DNS_MONITORS_PER_TEAM) {
			throw new ToolError(`Maximum of ${MAX_DNS_MONITORS_PER_TEAM} DNS monitors per team`);
		}

		let zoneFile: ZoneFileImport | null = null;
		if (ctx.input.zoneFile !== undefined && ctx.input.zoneFile.trim() !== "") {
			let parsed = parseZoneFile(ctx.input.zoneFile, ctx.input.domain);
			if (isFailure(parsed)) {
				throw new ToolError(`zoneFile must be ${MAX_ZONE_FILE_BYTES} bytes or smaller`);
			}
			zoneFile = parsed.data;
		}

		let names = discoveryNames(ctx.input.domain, zoneFile?.records ?? []);
		if (names.length > MAX_TRACKED_NAMES_PER_MONITOR) {
			throw new ToolError(
				`zoneFile declares ${names.length} names, over the ${MAX_TRACKED_NAMES_PER_MONITOR} name limit for one monitor`,
			);
		}

		let dnsMonitor = unwrap(
			await ctx.models.dnsMonitors.create({
				team_id: ctx.apiTeam.id,
				name: ctx.input.name,
				domain: ctx.input.domain,
				zone_file_imported_at: zoneFile === null ? null : Date.now(),
				interval_seconds: ctx.input.intervalSeconds,
				is_enabled: ctx.input.isEnabled,
				registration_warning_days: ctx.input.registrationWarningDays,
			}),
		);

		let imported = 0;
		let queriesFailed = 0;
		try {
			let discovery = await importDiscovery(
				ctx.models,
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

		return {
			dnsMonitor: serializeDnsMonitor(dnsMonitor),
			discovery: serializeDiscovery(names, imported, queriesFailed, zoneFile),
		};
	},
});
