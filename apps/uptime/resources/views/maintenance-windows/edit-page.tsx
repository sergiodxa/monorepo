/**
 * The edit maintenance window page, drawn by the edit route and again by the update action
 * when it refuses a submission, so a rejected form comes back holding everything that was
 * typed with an issue beside each field to fix. Deleting sits last, behind a confirmation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { toDateTimeLocal } from "@sdxc/dates";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, Form, Input, LinkButton, Switch, TextField } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { ScopeMonitorGroup } from "~/app/services/scope-monitors";
import type { SelectMaintenanceWindow } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import { fieldIssue, submittedChecked, submittedText } from "~/app/http/validators/form-submission";
import { MAINTENANCE_TIME_ZONE } from "~/app/http/validators/maintenance-window";
import { isActiveAt } from "~/app/models/maintenance-windows";
import { storedMonitorScope } from "~/app/services/monitor-scope";
import { withPrefix } from "~/app/services/prefixed-translate";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import MonitorScopeField from "~/resources/components/monitor-scope-field";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** `id` shared by the delete-confirmation trigger and its {@link AlertDialog}. */
const DELETE_DIALOG_ID = "delete-maintenance-window";

export namespace EditMaintenanceWindowPage {
	export interface Props {
		window: SelectMaintenanceWindow;
		/** The team's monitors grouped by kind, offered as the window's coverage. */
		scopeGroups: ScopeMonitorGroup[];
		/** The submission the update action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function EditMaintenanceWindowPage(handle: Handle<EditMaintenanceWindowPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { window, scopeGroups, submission } = handle.props;

		let isActive = window.ended_early_at === null && isActiveAt(window, Date.now());
		let heading = ctx.intl.t("page.editMaintenance.header.title", { name: window.name });
		let indexHref = routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug });
		let fields = withPrefix(ctx.intl.t, "page.maintenanceWindows.form.fields");
		let startsIssue = fieldIssue(submission, "starts_at");
		let endsIssue = fieldIssue(submission, "ends_at");

		return (
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${heading}`}>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.maintenanceWindows.edit.href({
						team: ctx.team.slug,
						windowId: window.id,
					})}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={heading}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.maintenance"),
							href: indexHref,
						},
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<Form
								method="post"
								action={routes.actions.maintenanceWindow.update.href({ team: ctx.team.slug })}
								issues={submission?.issues}
							>
								<input type="hidden" name="window_id" value={window.id} />
								<div mix={[vstack({ gap: 12 })]}>
									<SettingsSection
										id="coverage"
										title={ctx.intl.t("page.editMaintenance.form.sections.coverage.title")}
										description={ctx.intl.t(
											"page.editMaintenance.form.sections.coverage.description",
										)}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												<TextField
													label={fields("name.label")}
													type="text"
													name="name"
													required
													defaultValue={submittedText(submission, "name", window.name)}
												/>

												<MonitorScopeField
													groups={scopeGroups}
													selected={storedMonitorScope(window)}
													description={fields("scope.description")}
													intl={ctx.intl}
													submission={submission}
												/>
											</SettingsSection.Body>
										</SettingsSection.Card>
									</SettingsSection>

									<SettingsSection
										id="schedule"
										title={ctx.intl.t("page.editMaintenance.form.sections.schedule.title")}
										description={ctx.intl.t(
											"page.editMaintenance.form.sections.schedule.description",
										)}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												<Field
													label={fields("startsAt.label")}
													error={startsIssue}
													errorId="maintenance-window-starts-at-error"
												>
													<Input
														id="maintenance-window-starts-at"
														type="datetime-local"
														name="starts_at"
														required
														defaultValue={submittedText(
															submission,
															"starts_at",
															toDateTimeLocal(new Date(window.starts_at), MAINTENANCE_TIME_ZONE),
														)}
														aria-invalid={startsIssue ? "true" : undefined}
														aria-describedby={
															startsIssue ? "maintenance-window-starts-at-error" : undefined
														}
													/>
												</Field>

												<Field
													label={fields("endsAt.label")}
													error={endsIssue}
													errorId="maintenance-window-ends-at-error"
												>
													<Input
														id="maintenance-window-ends-at"
														type="datetime-local"
														name="ends_at"
														required
														defaultValue={submittedText(
															submission,
															"ends_at",
															toDateTimeLocal(new Date(window.ends_at), MAINTENANCE_TIME_ZONE),
														)}
														aria-invalid={endsIssue ? "true" : undefined}
														aria-describedby={
															endsIssue ? "maintenance-window-ends-at-error" : undefined
														}
													/>
												</Field>
											</SettingsSection.Body>
										</SettingsSection.Card>
									</SettingsSection>

									<SettingsSection
										id="behavior"
										title={ctx.intl.t("page.editMaintenance.form.sections.behavior.title")}
										description={ctx.intl.t(
											"page.editMaintenance.form.sections.behavior.description",
										)}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												<div mix={[vstack({ gap: SETTINGS_SWITCH_GAP })]}>
													<Switch
														name="suppress_alerts"
														value="true"
														defaultChecked={submittedChecked(
															submission,
															"suppress_alerts",
															window.suppress_alerts ?? true,
														)}
													>
														{fields("suppressAlerts.label")}
													</Switch>

													<Switch
														name="show_on_status_page"
														value="true"
														defaultChecked={submittedChecked(
															submission,
															"show_on_status_page",
															window.show_on_status_page ?? true,
														)}
													>
														{fields("showOnStatusPage.label")}
													</Switch>
												</div>
											</SettingsSection.Body>
										</SettingsSection.Card>
									</SettingsSection>

									<SettingsSection
										id="recurrence"
										title={ctx.intl.t("page.editMaintenance.form.sections.recurrence.title")}
										description={ctx.intl.t(
											"page.editMaintenance.form.sections.recurrence.description",
										)}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												<Switch
													name="is_recurring"
													value="true"
													defaultChecked={submittedChecked(
														submission,
														"is_recurring",
														window.is_recurring ?? false,
													)}
												>
													{fields("recurring.label")}
												</Switch>

												<TextField
													label={fields("recurringPattern.label")}
													name="recurring_pattern"
													defaultValue={submittedText(
														submission,
														"recurring_pattern",
														window.recurring_pattern ?? "",
													)}
													placeholder={fields("recurringPattern.placeholder")}
													description={fields("recurringPattern.description")}
												/>
											</SettingsSection.Body>
											<SettingsSection.Footer>
												<LinkButton variant="outline" href={indexHref}>
													{ctx.intl.t("page.editMaintenance.form.cancel")}
												</LinkButton>
												<Button type="submit">{ctx.intl.t("page.editMaintenance.form.cta")}</Button>
											</SettingsSection.Footer>
										</SettingsSection.Card>
									</SettingsSection>
								</div>
							</Form>

							{isActive && (
								<SettingsSection
									id="end-now"
									title={ctx.intl.t("page.editMaintenance.endNow.title")}
									description={ctx.intl.t("page.editMaintenance.endNow.description")}
								>
									<SettingsSection.Card>
										<form
											method="post"
											action={routes.actions.maintenanceWindow.end.href({ team: ctx.team.slug })}
										>
											<input type="hidden" name="window_id" value={window.id} />
											<SettingsSection.Body>
												<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
													{ctx.intl.t("page.editMaintenance.endNow.warning")}
												</p>
											</SettingsSection.Body>
											<SettingsSection.Footer>
												<Button type="submit" variant="outline">
													{ctx.intl.t("page.editMaintenance.endNow.cta")}
												</Button>
											</SettingsSection.Footer>
										</form>
									</SettingsSection.Card>
								</SettingsSection>
							)}

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.intl.t("page.editMaintenance.danger.title")}
								description={ctx.intl.t("page.editMaintenance.danger.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.intl.t("page.editMaintenance.danger.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_DIALOG_ID}
											command="show-modal"
										>
											{ctx.intl.t("page.editMaintenance.danger.delete.trigger")}
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
										{ctx.intl.t("page.editMaintenance.danger.delete.confirmTitle")}
									</AlertDialog.Title>
									<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
										{ctx.intl.t("page.editMaintenance.danger.delete.confirmDescription")}
									</AlertDialog.Description>
								</AlertDialog.Header>
								<form
									method="post"
									action={routes.actions.maintenanceWindow.delete.href({ team: ctx.team.slug })}
								>
									<input type="hidden" name="_method" value="DELETE" />
									<input type="hidden" name="window_id" value={window.id} />
									<AlertDialog.Footer>
										<AlertDialog.Cancel commandfor={DELETE_DIALOG_ID}>
											{ctx.intl.t("page.editMaintenance.form.cancel")}
										</AlertDialog.Cancel>
										<AlertDialog.Action commandfor={DELETE_DIALOG_ID} type="submit">
											{ctx.intl.t("page.editMaintenance.danger.delete.confirm")}
										</AlertDialog.Action>
									</AlertDialog.Footer>
								</form>
							</AlertDialog>
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
