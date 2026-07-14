/**
 * Edit alert page controller. Requires `requireUser` + `requireTeam`; 404s when the
 * alert doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import Alert from "~/app/data/alert";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

/** GET /app/:team/alerts/:alertId/edit — an alert's edit form. */
export default createAction(routes.app.team.alerts.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { alertId } = s.parse(s.object({ alertId: s.string() }), ctx.params);
		let alert = await Alert.findByIdForTeam(db, ctx.team.id, alertId);
		if (!alert) return notFound("Not Found");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${alert.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading="Edit Alert"
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.alerts"),
							href: routes.app.team.alerts.index.href({ team: ctx.team.slug }),
						},
						{ label: alert.name },
					]}
				>
					<div>
						<form method="post" action={routes.actions.alert.update.href({ team: ctx.team.slug })}>
							<input type="hidden" name="alert_id" value={alert.id} />
							<AlertFormFields alert={alert} monitors={monitors} />
							<Button type="submit">Save changes</Button>
						</form>

						<a
							href={routes.app.team.alerts.index.href({ team: ctx.team.slug })}
							mix={css({
								color: primary[600],
								textDecoration: "none",
								"&:hover": { textDecoration: "underline" },
								"@media (prefers-color-scheme: dark)": { color: primary[400] },
							})}
						>
							Cancel
						</a>

						<h2>Danger zone</h2>
						<Button type="button" color="danger" commandfor="delete-alert" command="show-modal">
							Delete alert
						</Button>
						<dialog
							id="delete-alert"
							mix={css({
								padding: 24,
								borderRadius: 8,
								border: `1px solid ${neutral[300]}`,
								maxWidth: 400,
								"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
									color: neutral[50],
								},
							})}
						>
							<h3>Delete this alert?</h3>
							<p
								mix={css({
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								})}
							>
								This can't be undone.
							</p>
							<form
								method="post"
								action={routes.actions.alert.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="alert_id" value={alert.id} />
								<div mix={css({ display: "flex", gap: 8, justifyContent: "flex-end" })}>
									<Button type="button" variant="outline" commandfor="delete-alert" command="close">
										Cancel
									</Button>
									<Button type="submit" color="danger">
										Delete
									</Button>
								</div>
							</form>
						</dialog>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
