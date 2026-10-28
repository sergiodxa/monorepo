/**
 * Answers `create_tcp_monitor`: creates a TCP monitor for the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeTcpMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Creates a TCP monitor for the calling key's team. */
export default createTool(toolset.createTcpMonitor, {
	...forAbility(abilities.tcpMonitors.write),
	handler: async (ctx) => {
		let monitor = unwrap(
			await ctx.models.tcpMonitors.create({
				team_id: ctx.apiTeam.id,
				name: ctx.input.name,
				host: ctx.input.host,
				port: ctx.input.port,
				timeout_ms: ctx.input.timeoutMs,
				interval_seconds: ctx.input.intervalSeconds,
				is_enabled: ctx.input.isEnabled,
			}),
		);
		return { monitor: serializeTcpMonitor(monitor) };
	},
});
