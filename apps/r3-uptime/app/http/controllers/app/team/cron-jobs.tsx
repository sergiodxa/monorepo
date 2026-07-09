/**
 * Cron-job monitors list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import CronJobsView from "~/resources/views/cron-jobs/index";
import routes from "~/routes/web";

/** GET /app/:team/cron-jobs — the team's cron-job monitors list. */
export default createAction(
	routes.app.team.cronJobs,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await CronJobMonitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Cron job monitors`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
				>
					<CronJobsView team={ctx.team} monitors={monitors} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
);
