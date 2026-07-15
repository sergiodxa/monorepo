/**
 * Edit status page page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the page doesn't belong to the current team.
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

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import StatusPageFormFields from "~/resources/views/status-pages/form";
import routes from "~/routes/web";

/** GET /app/:team/status-pages/:statusPageId/edit — a status page's edit form. */
export default createAction(routes.app.team.statusPages.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { statusPageId } = s.parse(s.object({ statusPageId: s.string() }), ctx.params);
		let page = await StatusPage.findByIdForTeam(db, ctx.team.id, statusPageId);
		if (!page) return notFound("Not Found");

		let [monitors, dnsMonitors, tcpMonitors, cronJobs, attachedIds] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			DnsMonitor.listByTeam(db, ctx.team.id),
			TcpMonitor.listByTeam(db, ctx.team.id),
			CronJobMonitor.listByTeam(db, ctx.team.id),
			StatusPage.getAttachedIds(db, statusPageId),
		]);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${page.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.editStatusPage.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.statusPages"),
							href: routes.app.team.statusPages.index.href({ team: ctx.team.slug }),
						},
						{ label: page.name },
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.statusPage.update.href({ team: ctx.team.slug })}
						>
							<input type="hidden" name="status_page_id" value={page.id} />
							<StatusPageFormFields
								page={page}
								monitors={monitors}
								dnsMonitors={dnsMonitors}
								tcpMonitors={tcpMonitors}
								cronJobs={cronJobs}
								attachedMonitorIds={attachedIds.monitorIds}
								attachedDnsMonitorIds={attachedIds.dnsMonitorIds}
								attachedTcpMonitorIds={attachedIds.tcpMonitorIds}
								attachedCronJobIds={attachedIds.cronJobIds}
							/>
							<Button type="submit">{ctx.i18next.t("page.statusPages.form.ctaUpdate")}</Button>
						</form>

						<a
							href={routes.app.team.statusPages.index.href({ team: ctx.team.slug })}
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

						<h2>Danger zone</h2>
						<Button
							type="button"
							color="danger"
							commandfor="delete-status-page"
							command="show-modal"
						>
							{ctx.i18next.t("page.statusPages.table.actions.delete")}
						</Button>
						<dialog
							id="delete-status-page"
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
								{ctx.i18next.t("page.statusPages.table.confirmation.delete", { name: page.name })}
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
								This can't be undone.
							</p>
							<form
								method="post"
								action={routes.actions.statusPage.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="status_page_id" value={page.id} />
								<div mix={[css({ display: "flex", gap: 8, justifyContent: "flex-end" })]}>
									<Button
										type="button"
										variant="outline"
										commandfor="delete-status-page"
										command="close"
									>
										{ctx.i18next.t("page.editMonitor.form.cancel")}
									</Button>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.statusPages.table.actions.delete")}
									</Button>
								</div>
							</form>
						</dialog>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
