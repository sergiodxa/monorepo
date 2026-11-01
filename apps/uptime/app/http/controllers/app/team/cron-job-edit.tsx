/**
 * Edit cron-job monitor page controller. Requires `requireUser` + `requireTeam`; 404s when
 * the monitor doesn't belong to the current team. The update action draws the same page again
 * with what was typed and the issues when it refuses a submission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import EditCronJobPage from "~/resources/views/cron-jobs/edit-page";
import routes from "~/routes/web";

/**
 * GET /app/:team/cron-jobs/:monitorId/edit — a cron-job monitor's edit form. The danger zone
 * renders only for a member allowed to delete cron jobs.
 */
export default createAction(routes.app.team.cronJobs.edit, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.cronJobMonitors
			.inTeam(ctx.team.id)
			.where({ id: monitorId })
			.first();
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.cronJobs.delete);
		return ctx.render(
			<EditCronJobPage monitor={monitor} canDelete={ctx.access.can(abilities.cronJobs.delete)} />,
		);
	},
});
