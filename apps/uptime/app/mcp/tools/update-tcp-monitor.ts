/**
 * Answers `update_tcp_monitor`: updates a TCP monitor (PUT-equivalent body).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import type { InsertTcpMonitor } from "~/database/schema";

import { forAbility } from "~/app/mcp/ability";
import { serializeTcpMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Updates a TCP monitor; only provided fields are written. */
export default createTool(toolset.updateTcpMonitor, {
	...forAbility(abilities.tcpMonitors.write),
	handler: async (ctx) => {
		let { tcpMonitorId, ...fields } = ctx.input;
		let existing = await ctx.models.tcpMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: tcpMonitorId })
			.first();
		if (!existing) throw new ToolError("TCP monitor not found");

		let changes: Partial<InsertTcpMonitor> = {};
		if (fields.name !== undefined) changes.name = fields.name;
		if (fields.host !== undefined) changes.host = fields.host;
		if (fields.port !== undefined) changes.port = fields.port;
		if (fields.timeoutMs !== undefined) changes.timeout_ms = fields.timeoutMs;
		if (fields.intervalSeconds !== undefined) changes.interval_seconds = fields.intervalSeconds;
		if (fields.isEnabled !== undefined) changes.is_enabled = fields.isEnabled;

		let monitor = unwrap(await ctx.models.tcpMonitors.update(tcpMonitorId, changes));
		return { monitor: serializeTcpMonitor(monitor) };
	},
});
