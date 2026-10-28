/**
 * Answers `create_email_alert`: creates an email alert for the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import { createAlertForStrategy } from "~/app/mcp/tools/create-alert-shared";
import abilities from "~/app/policies/abilities";

/** Creates an email alert. */
export default createTool(toolset.createEmailAlert, {
	...forAbility(abilities.alerts.write),
	handler: async (ctx) => createAlertForStrategy(ctx, { strategy: "email", ...ctx.input }),
});
