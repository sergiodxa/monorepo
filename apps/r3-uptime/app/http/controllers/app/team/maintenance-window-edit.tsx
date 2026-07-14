/**
 * Edit maintenance window page controller. Requires `requireUser` + `requireTeam`;
 * 404s when the window doesn't belong to the current team.
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

import MaintenanceWindow from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import MaintenanceWindowFormFields from "~/resources/views/maintenance-windows/form";
import routes from "~/routes/web";

/** GET /app/:team/maintenance/:windowId/edit — a maintenance window's edit form. */
export default createAction(routes.app.team.maintenanceWindows.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { windowId } = s.parse(s.object({ windowId: s.string() }), ctx.params);
		let window = await MaintenanceWindow.findByIdForTeam(db, ctx.team.id, windowId);
		if (!window) return notFound("Not Found");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let isActive =
			window.ended_early_at === null && MaintenanceWindow.isActiveAt(window, Date.now());

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${window.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={`Edit ${window.name}`}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.maintenance"),
							href: routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }),
						},
						{ label: window.name },
					]}
				>
					<div>
						<form
							method="post"
							action={routes.actions.maintenanceWindow.update.href({ team: ctx.team.slug })}
						>
							<input type="hidden" name="window_id" value={window.id} />
							<MaintenanceWindowFormFields window={window} monitors={monitors} />
							<Button type="submit">Save changes</Button>
						</form>

						<a
							href={routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug })}
							mix={css({
								color: primary[600],
								textDecoration: "none",
								"&:hover": { textDecoration: "underline" },
								"@media (prefers-color-scheme: dark)": { color: primary[400] },
							})}
						>
							Cancel
						</a>

						{isActive && (
							<form
								method="post"
								action={routes.actions.maintenanceWindow.end.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="window_id" value={window.id} />
								<Button type="submit" variant="outline">
									End maintenance now
								</Button>
							</form>
						)}

						<h2>Danger zone</h2>
						<Button
							type="button"
							color="danger"
							commandfor="delete-maintenance-window"
							command="show-modal"
						>
							Delete maintenance window
						</Button>
						<dialog
							id="delete-maintenance-window"
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
							<h3>Delete this maintenance window?</h3>
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
								action={routes.actions.maintenanceWindow.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="window_id" value={window.id} />
								<div mix={css({ display: "flex", gap: 8, justifyContent: "flex-end" })}>
									<Button
										type="button"
										variant="outline"
										commandfor="delete-maintenance-window"
										command="close"
									>
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
