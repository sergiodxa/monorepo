/**
 * Answers `ping_dns`: one throwaway DNS lookup, billed as a metered ping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import { runPingDns } from "~/app/mcp/tools/ping-shared";
import abilities from "~/app/policies/abilities";

/** Runs one throwaway DNS lookup against a domain the caller names. */
export default createTool(toolset.pingDns, {
	...forAbility(abilities.ping.trigger),
	handler: async (ctx) => runPingDns(ctx, ctx.input),
});
