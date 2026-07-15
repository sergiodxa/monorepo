/**
 * Edit DNS monitor page controller: settings form, posting to `update-dns-monitor`.
 * Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong to the
 * current team.
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

import DnsMonitor from "~/app/data/dns-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import DnsMonitorFormFields from "~/resources/views/dns-monitors/form";
import routes from "~/routes/web";

/** GET /app/:team/dns/:monitorId/edit — a DNS monitor's edit form. */
export default createAction(routes.app.team.dnsMonitors.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.editDnsMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
						{
							label: monitor.name,
							href: routes.app.team.dnsMonitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							}),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.dns.update.href({ team: ctx.team.slug })}
						>
							<input type="hidden" name="monitor_id" value={monitor.id} />
							<DnsMonitorFormFields monitor={monitor} />
							<Button type="submit">{ctx.i18next.t("page.editDnsMonitor.form.cta")}</Button>
						</form>

						<a
							href={routes.app.team.dnsMonitors.show.href({
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
							{ctx.i18next.t("page.editDnsMonitor.form.cancel")}
						</a>

						<h2>Danger zone</h2>
						<Button
							type="button"
							color="danger"
							commandfor="delete-dns-monitor"
							command="show-modal"
						>
							Delete monitor
						</Button>
						<dialog
							id="delete-dns-monitor"
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
								{ctx.i18next.t("page.dnsMonitors.table.confirmation.delete", {
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
								This also deletes its check-result history. This can't be undone.
							</p>
							<form
								method="post"
								action={routes.actions.monitor.dns.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<div mix={[css({ display: "flex", gap: 8, justifyContent: "flex-end" })]}>
									<Button
										type="button"
										variant="outline"
										commandfor="delete-dns-monitor"
										command="close"
									>
										{ctx.i18next.t("page.editDnsMonitor.form.cancel")}
									</Button>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.dnsMonitors.table.actions.delete")}
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
