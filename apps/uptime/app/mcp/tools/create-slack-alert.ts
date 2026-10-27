/**
 * Answers `create_slack_alert`: creates a Slack incoming-webhook alert for the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import { createAlertForStrategy } from "~/app/mcp/tools/create-alert-shared";
import abilities from "~/app/policies/abilities";

/** Creates a Slack alert. */
export default createTool(toolset.createSlackAlert, {
	...forAbility(abilities.alerts.write),
	handler: async (ctx) => createAlertForStrategy(ctx, { strategy: "slack", ...ctx.input }),
});
