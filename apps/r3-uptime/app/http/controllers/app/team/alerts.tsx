/**
 * Alerts list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
					breadcrumb="Alerts"
					actions={
						<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
							<a
								href={routes.app.team.alerts.history.href({ team: ctx.team.slug })}
								mix={[
									css({
										color: "oklch(0.6 0.16 142)",
										textDecoration: "none",
										"&:hover": { textDecoration: "underline" },
										"@media (prefers-color-scheme: dark)": { color: "oklch(0.78 0.16 142)" },
									}),
								]}
							>
								View history
							</a>
							{!atLimit && (
								<a
									href={routes.app.team.alerts.new.href({ team: ctx.team.slug })}
									mix={[
										css({
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											padding: "8px 16px",
											borderRadius: 6,
											border: "1px solid transparent",
											background: "oklch(0.24 0.005 145)",
											color: "#ffffff",
											fontFamily: "inherit",
											fontSize: "0.875rem",
											fontWeight: 500,
											cursor: "pointer",
											textDecoration: "none",
											"&:hover": { background: "oklch(0.32 0.006 145)" },
										}),
									]}
								>
									New alert
								</a>
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
