/**
 * Answers `create_invite`: creates a pending invite for the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeInvite } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { refuseUndeliverableRecipient } from "~/app/services/email-address";

/** Creates a pending invite; refuses undeliverable or duplicate emails. */
export default createTool(toolset.createInvite, {
	...forAbility(abilities.invites.write),
	handler: async (ctx) => {
		let undeliverable = await refuseUndeliverableRecipient(ctx.input.email, "/email");
		if (undeliverable) throw new ToolError("That email address cannot receive mail.");

		if (await ctx.models.invites.inTeam(ctx.apiTeam.id).where({ email: ctx.input.email }).first()) {
			throw new ToolError("An invite for this email already exists");
		}

		let invite = unwrap(
			await ctx.models.invites.create({
				team_id: ctx.apiTeam.id,
				sender_id: ctx.apiTeam.owner_id,
				email: ctx.input.email,
			}),
		);
		return { invite: serializeInvite(invite) };
	},
});
