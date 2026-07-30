/**
 * Edit TCP monitor page controller: settings form, posting to `update-tcp-monitor`.
 * Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong to the
 * current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { AlertDialog, Button } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

/** GET /app/:team/tcp/:monitorId/edit — a TCP monitor's edit form. */
export default createAction(routes.app.team.tcpMonitors.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await TcpMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.editTcpMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.i18next.t("page.editTcpMonitor.header.breadcrumb.tcpMonitors"),
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
						{
							label: monitor.name,
							href: routes.app.team.tcpMonitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							}),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.tcp.update.href({ team: ctx.team.slug })}
						>
							<input type="hidden" name="monitor_id" value={monitor.id} />
							<TcpMonitorFormFields monitor={monitor} i18next={ctx.i18next} page="editTcpMonitor" />
							<Button type="submit">{ctx.i18next.t("page.editTcpMonitor.form.cta")}</Button>
						</form>

						<a
							href={routes.app.team.tcpMonitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
						>
							{ctx.i18next.t("page.editTcpMonitor.form.cancel")}
						</a>

						<h2>{ctx.i18next.t("page.editTcpMonitor.danger.title")}</h2>
						<Button
							type="button"
							color="danger"
							commandfor="delete-tcp-monitor"
							command="show-modal"
						>
							{ctx.i18next.t("page.editTcpMonitor.danger.cta")}
						</Button>
						<AlertDialog
							id="delete-tcp-monitor"
							aria-labelledby="delete-tcp-monitor-title"
							aria-describedby="delete-tcp-monitor-description"
						>
							<AlertDialog.Header>
								<AlertDialog.Title id="delete-tcp-monitor-title">
									{ctx.i18next.t("page.tcpMonitors.table.actions.confirmation.delete", {
										name: monitor.name,
									})}
								</AlertDialog.Title>
								<AlertDialog.Description id="delete-tcp-monitor-description">
									{ctx.i18next.t("page.editTcpMonitor.danger.description")}
								</AlertDialog.Description>
							</AlertDialog.Header>
							<form
								method="post"
								action={routes.actions.monitor.tcp.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<AlertDialog.Footer>
									<AlertDialog.Cancel type="button" commandfor="delete-tcp-monitor">
										{ctx.i18next.t("page.editTcpMonitor.form.cancel")}
									</AlertDialog.Cancel>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.tcpMonitors.table.actions.delete")}
									</Button>
								</AlertDialog.Footer>
							</form>
						</AlertDialog>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
