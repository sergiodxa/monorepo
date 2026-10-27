/**
 * Answers `update_dns_monitor`: updates a DNS monitor (PUT-equivalent body).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import type { InsertDnsMonitor } from "~/database/schema";

import { forAbility } from "~/app/mcp/ability";
import { serializeDnsMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Updates a DNS monitor; only provided fields are written. */
export default createTool(toolset.updateDnsMonitor, {
	...forAbility(abilities.dnsMonitors.write),
	handler: async (ctx) => {
		let { dnsMonitorId, ...fields } = ctx.input;
		let existing = await ctx.models.dnsMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: dnsMonitorId })
			.first();
		if (!existing) throw new ToolError("DNS monitor not found");

		let changes: Partial<InsertDnsMonitor> = {};
		if (fields.name !== undefined) changes.name = fields.name;
		if (fields.domain !== undefined) changes.domain = fields.domain;
		if (fields.intervalSeconds !== undefined) changes.interval_seconds = fields.intervalSeconds;
		if (fields.isEnabled !== undefined) changes.is_enabled = fields.isEnabled;
		if (
			fields.registrationWarningDays !== undefined &&
			fields.registrationWarningDays !== existing.registration_warning_days
		) {
			changes.registration_warning_days = fields.registrationWarningDays;
		}

		let monitor = unwrap(await ctx.models.dnsMonitors.update(dnsMonitorId, changes));
		return { dnsMonitor: serializeDnsMonitor(monitor) };
	},
});
