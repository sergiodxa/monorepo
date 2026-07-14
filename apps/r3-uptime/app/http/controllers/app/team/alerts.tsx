/**
 * Alerts list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellPlusIcon, HistoryIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import Alert, { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import AlertsView from "~/resources/views/alerts/index";
import routes from "~/routes/web";

/** GET /app/:team/alerts — the team's alerts list. */
export default createAction(routes.app.team.alerts.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let alerts = await Alert.listByTeam(db, ctx.team.id);
		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let monitorsById = new Map(monitors.map((monitor) => [monitor.id, monitor]));
		let atLimit = alerts.length >= MAX_ALERTS_PER_TEAM;

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Alerts`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading="Alerts"
					breadcrumbs={[
						{
							label: "Dashboard",
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{ label: "Alerts" },
					]}
					actions={
						<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
							<LinkButton
								variant="outline"
								href={routes.app.team.alerts.history.href({ team: ctx.team.slug })}
							>
								<HistoryIcon size={16} strokeWidth={1.5} />
								View History
							</LinkButton>
							{!atLimit && (
								<LinkButton href={routes.app.team.alerts.new.href({ team: ctx.team.slug })}>
									<BellPlusIcon size={16} strokeWidth={1.5} />
									Create Alert
								</LinkButton>
							)}
						</div>
					}
				>
					<AlertsView team={ctx.team} alerts={alerts} monitorsById={monitorsById} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
