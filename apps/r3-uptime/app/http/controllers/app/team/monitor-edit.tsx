/**
 * Edit HTTP monitor page controller: general settings form (posts to
 * `update-monitor`), the content-checks section, and the SSL monitoring settings
 * form. Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong
 * to the current team.
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

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import ContentChecksSection from "~/resources/views/monitors/content-checks";
import MonitorFormFields from "~/resources/views/monitors/form";
import SslForm from "~/resources/views/monitors/ssl-form";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId/edit — a monitor's edit form. */
export default createAction(routes.app.team.monitors.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let contentChecks = await ContentCheck.listByMonitor(db, monitor.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.editMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: monitor.name,
							href: routes.app.team.monitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							}),
						},
					]}
				>
					<div>
						<form
							method="post"
							action={routes.actions.monitor.http.update.href({ team: ctx.team.slug })}
						>
							<input type="hidden" name="monitor_id" value={monitor.id} />
							<MonitorFormFields monitor={monitor} />
							<Button type="submit">{ctx.i18next.t("page.editMonitor.form.cta")}</Button>
						</form>

						<a
							href={routes.app.team.monitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							mix={[
								css({
									color: primary[600],
									textDecoration: "none",
									"&:hover": { textDecoration: "underline" },
									"@media (prefers-color-scheme: dark)": { color: primary[400] },
								}),
							]}
						>
							{ctx.i18next.t("page.editMonitor.form.cancel")}
						</a>

						<ContentChecksSection
							team={ctx.team}
							monitorId={monitor.id}
							contentChecks={contentChecks}
						/>

						<SslForm team={ctx.team} monitor={monitor} />

						<h2>Danger zone</h2>
						<Button type="button" color="danger" commandfor="delete-monitor" command="show-modal">
							Delete monitor
						</Button>
						<dialog
							id="delete-monitor"
							mix={[
								css({
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
								}),
							]}
						>
							<h3>
								{ctx.i18next.t("page.httpMonitors.table.confirmation.delete", {
									name: monitor.name,
								})}
							</h3>
							<p
								mix={[
									css({
										fontSize: "0.8125rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								This also deletes its content checks and check-result history. This can't be undone.
							</p>
							<form
								method="post"
								action={routes.actions.monitor.http.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<div mix={[css({ display: "flex", gap: 8, justifyContent: "flex-end" })]}>
									<Button
										type="button"
										variant="outline"
										commandfor="delete-monitor"
										command="close"
									>
										{ctx.i18next.t("page.editMonitor.form.cancel")}
									</Button>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.httpMonitors.table.actions.delete")}
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
