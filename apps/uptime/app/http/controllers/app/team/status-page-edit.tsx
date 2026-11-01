/**
 * Edit status page controller. All settings, including monitor attachments, post through one
 * form to `update-status-page`, which draws the same page again with the posted values when it
 * refuses a submission; only the delete flow uses its own form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { listScopeMonitors } from "~/app/services/scope-monitors";
import EditStatusPagePage from "~/resources/views/status-pages/edit-page";
import routes from "~/routes/web";

/** GET /app/:team/status-pages/:statusPageId/edit — a status page's edit form. */
export default createAction(routes.app.team.statusPages.edit, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async (ctx) => {
		let { statusPageId } = s.parse(s.object({ statusPageId: s.string() }), ctx.params);
		let page = await ctx.models.statusPages.inTeam(ctx.team.id).find(statusPageId);
		if (!page) return notFound("Not Found");

		let [scopeGroups, attachedIds] = await Promise.all([
			listScopeMonitors(ctx.models, ctx.team.id),
			ctx.models.statusPages.getAttachedIds(page.id),
		]);
		return ctx.render(
			<EditStatusPagePage page={page} scopeGroups={scopeGroups} attachedIds={attachedIds} />,
		);
	},
});
