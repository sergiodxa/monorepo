/**
 * Answers `update_status_page`: updates a status page's own fields (PUT-equivalent body).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import type { InsertStatusPage } from "~/database/schema";

import { forAbility } from "~/app/mcp/ability";
import { loadStatusPageWithAttachments } from "~/app/mcp/status-pages";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Updates a status page's own fields and returns it with attachment ids. */
export default createTool(toolset.updateStatusPage, {
	...forAbility(abilities.statusPages.write),
	handler: async (ctx) => {
		let { statusPageId, ...fields } = ctx.input;
		let existing = await ctx.models.statusPages.inTeam(ctx.apiTeam.id).find(statusPageId);
		if (!existing) throw new ToolError("Status page not found");

		if (
			fields.slug !== undefined &&
			(await ctx.models.statusPages.isSlugTaken(fields.slug, existing.id))
		) {
			throw new ToolError("Slug is already in use");
		}

		let changes: Partial<InsertStatusPage> = {};
		if (fields.name !== undefined) changes.name = fields.name;
		if (fields.slug !== undefined) changes.slug = fields.slug;
		if (fields.title !== undefined) changes.title = fields.title;
		if (fields.description !== undefined) changes.description = fields.description ?? null;
		if (fields.logoUrl !== undefined) changes.logo_url = fields.logoUrl ?? null;
		if (fields.customDomain !== undefined) changes.custom_domain = fields.customDomain ?? null;
		if (fields.isPublic !== undefined) changes.is_public = fields.isPublic;
		if (fields.showOverallStatus !== undefined)
			changes.show_overall_status = fields.showOverallStatus;

		if (Object.keys(changes).length > 0) {
			unwrap(await ctx.models.statusPages.update(statusPageId, changes));
		}

		let statusPage = await loadStatusPageWithAttachments(ctx.models, ctx.apiTeam.id, statusPageId);
		if (!statusPage) throw new ToolError("Failed to load updated status page");
		return { statusPage };
	},
});
