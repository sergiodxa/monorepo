/**
 * Answers `ping_http`: one throwaway HTTP check, billed as a metered ping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import { runPingHttp } from "~/app/mcp/tools/ping-shared";
import abilities from "~/app/policies/abilities";

/** Runs one throwaway HTTP check against a URL the caller names. */
export default createTool(toolset.pingHttp, {
	...forAbility(abilities.ping.trigger),
	handler: async (ctx) => runPingHttp(ctx, ctx.input),
});
