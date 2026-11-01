/**
 * The edit DNS monitor page, drawn by the edit route and again by the update and zone-file
 * import actions when they refuse a submission, so a rejected form comes back holding what
 * was typed or pasted with a message on each field to fix. Deleting sits last, in its own danger zone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import {
	Alert,
	Button,
	Description,
	FieldError,
	LinkButton,
	RelativeTime,
	TextArea,
} from "@sdxc/ui";
import { DangerZone } from "@sdxc/ui/app";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { SelectDnsMonitor } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import { fieldIssue, submittedText } from "~/app/http/validators/form-submission";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import StepperField from "~/resources/components/stepper-field";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import DnsMonitorFormFields from "~/resources/views/dns-monitors/form";
import routes from "~/routes/web";

/** A marker no translation contains, standing in for the date while a sentence is split around it. */
const DATE_SLOT = "\u{E000}";

/** `id` linking the warning-window input to its label and its step buttons. */
const REGISTRATION_WARNING_DAYS_INPUT_ID = "dns-monitor-registration-warning-days";

export namespace EditDnsMonitorPage {
	export interface Props {
		monitor: SelectDnsMonitor;
		/** Whether the viewer may delete monitors, which decides whether the danger zone renders. */
		canDelete: boolean;
		/** The settings submission the update action refused; omitted on a first visit. */
		submission?: FormSubmission;
		/** The zone-file paste the import action refused, kept so the paste is never lost. */
		zoneFileSubmission?: FormSubmission;
	}
}

/**
 * The warning window a stepper starts on: the submitted text when it reads as a number, else
 * the saved window, since a stepper needs a number to step from.
 */
function warningDays(submitted: string, saved: number): number {
	if (submitted.trim() === "") return saved;
	let parsed = Number(submitted);
	return Number.isFinite(parsed) ? parsed : saved;
}

/**
 * Renders the whole document for the current request's team and signed-in viewer. Importing a
 * zone file re-runs discovery over its names while keeping whatever a visitor already decided
 * about each already-tracked record.
 */
export default function EditDnsMonitorPage(handle: Handle<EditDnsMonitorPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");

		let { monitor, canDelete, submission, zoneFileSubmission } = handle.props;
		let monitorParams = { team: ctx.team.slug, monitorId: monitor.id };
		let showHref = routes.app.team.dnsMonitors.show.href(monitorParams);
		let warningDaysIssue = fieldIssue(submission, "registration_warning_days");
		/**
		 * The sentence around the import date, split where the date goes so the date renders as
		 * a live relative time while each language keeps its own word order.
		 */
		let lastImported = ctx.intl
			.t("page.editDnsMonitor.zoneFileImport.lastImported", { date: DATE_SLOT })
			.split(DATE_SLOT);

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.editMonitor.header.named", {
					name: monitor.name,
				})}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.dnsMonitors.edit.href(monitorParams)}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.editDnsMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
						{ label: monitor.name, href: showHref },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							{(submission || zoneFileSubmission) && (
								<Alert id="dns-monitor-form-issues" color="danger">
									<Alert.Content>
										<Alert.Description>
											{ctx.intl.t("page.dnsMonitors.form.issues.summary")}
										</Alert.Description>
									</Alert.Content>
								</Alert>
							)}

							<form
								method="post"
								action={routes.actions.monitor.dns.update.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

								<SettingsSection
									id="basics"
									title={ctx.intl.t("page.editDnsMonitor.form.sections.basics.title")}
									description={ctx.intl.t("page.editDnsMonitor.form.sections.basics.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<DnsMonitorFormFields
												monitor={monitor}
												submission={submission}
												intl={ctx.intl}
												page="editDnsMonitor"
											/>
											<div>
												<StepperField
													id={REGISTRATION_WARNING_DAYS_INPUT_ID}
													name="registration_warning_days"
													label={ctx.intl.t(
														"page.editDnsMonitor.form.fields.registrationWarningDays.label",
													)}
													description={ctx.intl.t(
														"page.editDnsMonitor.form.fields.registrationWarningDays.description",
													)}
													decrementLabel={ctx.intl.t(
														"page.editDnsMonitor.form.fields.registrationWarningDays.decrement",
													)}
													incrementLabel={ctx.intl.t(
														"page.editDnsMonitor.form.fields.registrationWarningDays.increment",
													)}
													min={1}
													max={365}
													defaultValue={warningDays(
														submittedText(submission, "registration_warning_days", ""),
														monitor.registration_warning_days,
													)}
												/>
												{warningDaysIssue && <FieldError>{warningDaysIssue}</FieldError>}
											</div>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton variant="outline" href={showHref}>
												{ctx.intl.t("page.editDnsMonitor.form.cancel")}
											</LinkButton>
											<Button type="submit">{ctx.intl.t("page.editDnsMonitor.form.cta")}</Button>
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
									title={ctx.intl.t("page.editDnsMonitor.zoneFileImport.title")}
									description={ctx.intl.t("page.editDnsMonitor.zoneFileImport.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<Field
												label={ctx.intl.t("page.editDnsMonitor.form.fields.zoneFile.label")}
												description={ctx.intl.t(
													"page.editDnsMonitor.form.fields.zoneFile.description",
												)}
												error={fieldIssue(zoneFileSubmission, "zone_file")}
											>
												<TextArea
													name="zone_file"
													required
													placeholder={ctx.intl.t(
														"page.editDnsMonitor.form.fields.zoneFile.placeholder",
													)}
													defaultValue={submittedText(zoneFileSubmission, "zone_file", "")}
												/>
											</Field>

											<Description>
												{monitor.zone_file_imported_at === null ? (
													ctx.intl.t("page.editDnsMonitor.zoneFileImport.neverImported")
												) : (
													<>
														{lastImported[0]}
														<RelativeTime
															date={monitor.zone_file_imported_at}
															locale={ctx.locale}
															local
														/>
														{lastImported[1]}
													</>
												)}
											</Description>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<Button type="submit">
												{ctx.intl.t("page.editDnsMonitor.zoneFileImport.cta")}
											</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							{canDelete && (
								<DangerZone
									id="danger"
									title={ctx.intl.t("page.editDnsMonitor.dangerZone.title")}
									description={ctx.intl.t("page.editDnsMonitor.dangerZone.description")}
								>
									<DangerZone.Action
										id="delete-dns-monitor"
										title={ctx.intl.t("page.editDnsMonitor.dangerZone.deleteMonitor")}
										description={ctx.intl.t("page.editDnsMonitor.dangerZone.warning")}
										buttonLabel={ctx.intl.t("page.editDnsMonitor.dangerZone.deleteMonitor")}
										confirm={{
											title: ctx.intl.t("app.confirm.deleteDnsMonitor.title", {
												name: monitor.name,
											}),
											description: ctx.intl.t("page.editDnsMonitor.dangerZone.deleteDescription"),
											confirmLabel: ctx.intl.t("app.confirm.deleteMonitor.action"),
											cancelLabel: ctx.intl.t("page.editDnsMonitor.form.cancel"),
											form: {
												action: routes.actions.monitor.dns.delete.href({ team: ctx.team.slug }),
												method: "post",
												fields: (
													<>
														<input type="hidden" name="_method" value="DELETE" />
														<input type="hidden" name="monitor_id" value={monitor.id} />
													</>
												),
											},
										}}
									/>
								</DangerZone>
							)}
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
