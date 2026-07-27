/**
 * Edit DNS monitor page controller: settings form, posting to `update-dns-monitor`.
 * Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong to the
 * current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { AlertDialog } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { media } from "@pkg/u/responsive";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import DnsMonitor from "~/app/data/dns-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { primary } from "~/resources/theme";
import DnsMonitorFormFields from "~/resources/views/dns-monitors/form";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-dns-monitor";

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
							<DnsMonitorFormFields monitor={monitor} i18next={ctx.i18next} page="editDnsMonitor" />
							<Button type="submit">{ctx.i18next.t("page.editDnsMonitor.form.cta")}</Button>
						</form>

						<a
							href={routes.app.team.dnsMonitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							mix={[
								fg(primary[600]),
								textDecoration("none"),
								hover(textDecoration("underline")),
								media("(prefers-color-scheme: dark)", fg(primary[400])),
							]}
						>
							{ctx.i18next.t("page.editDnsMonitor.form.cancel")}
						</a>

						<h2>{ctx.i18next.t("page.editDnsMonitor.dangerZone.title")}</h2>
						<Button type="button" color="danger" commandfor={DELETE_DIALOG_ID} command="show-modal">
							{ctx.i18next.t("page.editDnsMonitor.dangerZone.deleteMonitor")}
						</Button>
						<AlertDialog
							id={DELETE_DIALOG_ID}
							aria-labelledby={`${DELETE_DIALOG_ID}-title`}
							aria-describedby={`${DELETE_DIALOG_ID}-description`}
						>
							<AlertDialog.Header>
								<AlertDialog.Title id={`${DELETE_DIALOG_ID}-title`}>
									{ctx.i18next.t("page.dnsMonitors.table.confirmation.delete", {
										name: monitor.name,
									})}
								</AlertDialog.Title>
								<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
									{ctx.i18next.t("page.editDnsMonitor.dangerZone.deleteDescription")}
								</AlertDialog.Description>
							</AlertDialog.Header>
							<form
								method="post"
								action={routes.actions.monitor.dns.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<AlertDialog.Footer>
									<AlertDialog.Cancel type="button" commandfor={DELETE_DIALOG_ID}>
										{ctx.i18next.t("page.editDnsMonitor.form.cancel")}
									</AlertDialog.Cancel>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.dnsMonitors.table.actions.delete")}
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
