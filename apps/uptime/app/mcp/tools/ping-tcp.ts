/**
 * Answers `ping_tcp`: one throwaway TCP connect check, billed as a metered ping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import { runPingTcp } from "~/app/mcp/tools/ping-shared";
import abilities from "~/app/policies/abilities";

/** Runs one throwaway TCP connect against a host and port the caller names. */
export default createTool(toolset.pingTcp, {
	...forAbility(abilities.ping.trigger),
	handler: async (ctx) => runPingTcp(ctx, ctx.input),
});
