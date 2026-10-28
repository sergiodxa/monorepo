/**
 * Answers `create_pagerduty_alert`: creates a PagerDuty Events API v2 alert for the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import { createAlertForStrategy } from "~/app/mcp/tools/create-alert-shared";
import abilities from "~/app/policies/abilities";

/** Creates a PagerDuty alert. */
export default createTool(toolset.createPagerdutyAlert, {
	...forAbility(abilities.alerts.write),
	handler: async (ctx) => createAlertForStrategy(ctx, { strategy: "pagerduty", ...ctx.input }),
});
