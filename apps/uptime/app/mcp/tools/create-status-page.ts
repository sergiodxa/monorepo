/**
 * Answers `create_status_page`: creates a status page for the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeStatusPage } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Creates a status page; slug must be globally unique. */
export default createTool(toolset.createStatusPage, {
	...forAbility(abilities.statusPages.write),
	handler: async (ctx) => {
		if (await ctx.models.statusPages.isSlugTaken(ctx.input.slug)) {
			throw new ToolError("Slug is already in use");
		}

		let statusPage = unwrap(
			await ctx.models.statusPages.create({
				team_id: ctx.apiTeam.id,
				name: ctx.input.name,
				slug: ctx.input.slug,
				title: ctx.input.title ?? ctx.input.name,
				description: ctx.input.description ?? null,
				logo_url: ctx.input.logoUrl ?? null,
				custom_domain: ctx.input.customDomain ?? null,
				is_public: ctx.input.isPublic,
				show_overall_status: ctx.input.showOverallStatus,
			}),
		);

		return { statusPage: serializeStatusPage(statusPage) };
	},
});
