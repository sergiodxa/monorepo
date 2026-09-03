/**
 * Edit DNS monitor page controller: settings form posting to
 * `update-dns-monitor`. Requires `requireUser` + `requireTeam` and 404s when
 * the monitor doesn't belong to the current team.
 *
 * Settings, zone import, and deletion post through separate `<form>`s
 * because each is a decision a visitor makes independently, at its own
 * moment.
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
import { AlertDialog, Button, Description, LinkButton, TextArea } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import DnsMonitor from "~/app/data/dns-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import DnsMonitorFormFields from "~/resources/views/dns-monitors/form";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-dns-monitor";

/**
 * GET /app/:team/dns/:monitorId/edit — a DNS monitor's edit form; importing a
 * zone file re-runs discovery over its names while keeping whatever a
 * visitor already decided about each already-tracked record.
 */
export default createAction(routes.app.team.dnsMonitors.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let showHref = routes.app.team.dnsMonitors.show.href({
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
					heading={ctx.i18next.t("page.editDnsMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
						{ label: monitor.name, href: showHref },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.monitor.dns.update.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

								<SettingsSection
									id="basics"
									title={ctx.i18next.t("page.editDnsMonitor.form.sections.basics.title")}
									description={ctx.i18next.t(
										"page.editDnsMonitor.form.sections.basics.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<DnsMonitorFormFields
												monitor={monitor}
												i18next={ctx.i18next}
												page="editDnsMonitor"
											/>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton variant="outline" href={showHref}>
												{ctx.i18next.t("page.editDnsMonitor.form.cancel")}
											</LinkButton>
											<Button type="submit">{ctx.i18next.t("page.editDnsMonitor.form.cta")}</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							<form
								method="post"
								action={routes.actions.monitor.dns.importZoneFile.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

								<SettingsSection
									id="zone-file"
									title={ctx.i18next.t("page.editDnsMonitor.zoneFileImport.title")}
									description={ctx.i18next.t("page.editDnsMonitor.zoneFileImport.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<Field
												label={ctx.i18next.t("page.editDnsMonitor.form.fields.zoneFile.label")}
												description={ctx.i18next.t(
													"page.editDnsMonitor.form.fields.zoneFile.description",
												)}
											>
												<TextArea
													name="zone_file"
													required
													placeholder={ctx.i18next.t(
														"page.editDnsMonitor.form.fields.zoneFile.placeholder",
													)}
												/>
											</Field>

											<Description>
												{monitor.zone_file_imported_at === null
													? ctx.i18next.t("page.editDnsMonitor.zoneFileImport.neverImported")
													: ctx.i18next.t("page.editDnsMonitor.zoneFileImport.lastImported", {
															date: new Date(monitor.zone_file_imported_at).toLocaleString(),
														})}
											</Description>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<Button type="submit">
												{ctx.i18next.t("page.editDnsMonitor.zoneFileImport.cta")}
											</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.i18next.t("page.editDnsMonitor.dangerZone.title")}
								description={ctx.i18next.t("page.editDnsMonitor.dangerZone.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.i18next.t("page.editDnsMonitor.dangerZone.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_DIALOG_ID}
											command="show-modal"
										>
											{ctx.i18next.t("page.editDnsMonitor.dangerZone.deleteMonitor")}
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
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
