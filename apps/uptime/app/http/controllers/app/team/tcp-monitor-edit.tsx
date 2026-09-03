/**
 * Edit TCP monitor page controller: settings form, posting to `update-tcp-monitor`.
 * Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong to
 * the current team. Settings and the destructive action each sit in their own
 * bordered card, the destructive one danger-toned, each posting through its own
 * `<form>`. The TCP fields render as a single block shared with the create page,
 * so both pages draw the same form. The delete confirmation composes `@sdxc/ui`'s
 * `AlertDialog` directly because confirming submits a real `<form method="post">`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { inject } from "@sdxc/service-container";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, LinkButton } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-tcp-monitor";

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

		let showHref = routes.app.team.tcpMonitors.show.href({
			team: ctx.team.slug,
			monitorId: monitor.id,
		});

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
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
						{ label: monitor.name, href: showHref },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.monitor.tcp.update.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

								<SettingsSection
									id="settings"
									title={ctx.i18next.t("page.editTcpMonitor.form.sections.settings.title")}
									description={ctx.i18next.t(
										"page.editTcpMonitor.form.sections.settings.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<TcpMonitorFormFields
												monitor={monitor}
												i18next={ctx.i18next}
												page="editTcpMonitor"
											/>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton variant="outline" href={showHref}>
												{ctx.i18next.t("page.editTcpMonitor.form.cancel")}
											</LinkButton>
											<Button type="submit">{ctx.i18next.t("page.editTcpMonitor.form.cta")}</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.i18next.t("page.editTcpMonitor.danger.title")}
								description={ctx.i18next.t("page.editTcpMonitor.danger.sectionDescription")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.i18next.t("page.editTcpMonitor.danger.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_DIALOG_ID}
											command="show-modal"
										>
											{ctx.i18next.t("page.editTcpMonitor.danger.cta")}
										</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>

							<AlertDialog
								id={DELETE_DIALOG_ID}
								aria-labelledby={`${DELETE_DIALOG_ID}-title`}
								aria-describedby={`${DELETE_DIALOG_ID}-description`}
							>
								<AlertDialog.Header>
									<AlertDialog.Title id={`${DELETE_DIALOG_ID}-title`}>
										{ctx.i18next.t("page.tcpMonitors.table.actions.confirmation.delete", {
											name: monitor.name,
										})}
									</AlertDialog.Title>
									<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
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
										<AlertDialog.Cancel type="button" commandfor={DELETE_DIALOG_ID}>
											{ctx.i18next.t("page.editTcpMonitor.form.cancel")}
										</AlertDialog.Cancel>
										<Button type="submit" color="danger">
											{ctx.i18next.t("page.tcpMonitors.table.actions.delete")}
										</Button>
									</AlertDialog.Footer>
								</form>
							</AlertDialog>
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
