/**
 * New cron-job monitor page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import NewCronJobView from "~/resources/views/cron-jobs/new";
import routes from "~/routes/web";

/** GET /app/:team/cron-jobs/new — the new cron-job monitor form. */
export default createAction(routes.app.team.cronJobs.new, {
	middleware: [requireUser, requireTeam],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New cron job monitor`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					breadcrumb="New cron job monitor"
				>
					<NewCronJobView team={ctx.team} />
				</AppShell>
			</DocumentLayout>,
		);
	},
});
