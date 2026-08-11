/**
 * Edit DNS monitor page controller: settings form, posting to `update-dns-monitor`.
 * Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong to the
 * current team.
 *
 * Three settings groups, each a bordered card with its own heading and action row, and each
 * on its own `<form>` posting to its own action: what the monitor is, the zone file its
 * tracked names come from, and the destructive card below both. They are separate forms
 * rather than one because they are separate decisions — renaming a monitor is not an
 * occasion to re-import a zone, and the zone file is not a value the monitor holds and
 * could re-submit unchanged.
 *
 * There is no record type and no expected value to edit: the records a monitor watches are
 * the monitor's own detail page, one row at a time, and are imported rather than typed.
 *
 * The delete confirmation is `@pkg/ui`'s `AlertDialog` composed directly rather than
 * through the `Confirm` convenience wrapper, since the confirming control is a real
 * `<form method="post">` submit button rather than a `command="close"` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { m } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { AlertDialog, Button, Description, LinkButton, TextArea } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

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

							{/*
							 * Its own form and its own action, not a field on the one above. The pasted
							 * text is never stored, so this box is always empty however many times a zone
							 * has been imported — there is nothing to pre-fill and nothing to save
							 * unchanged. Submitting it re-runs discovery over the names it declares; a
							 * record already tracked keeps whatever the visitor decided about it, so a
							 * re-paste adds names and never quietly re-enables a declined record.
							 */}
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

											{/*
											 * A zone file is a snapshot of the day it was pasted, so when it was
											 * pasted is the whole of what it is worth: it is what says whether the
											 * names this monitor sweeps still describe the zone.
											 */}
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
