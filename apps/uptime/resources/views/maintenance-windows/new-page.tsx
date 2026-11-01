/**
 * The new maintenance window page, drawn by the form's GET route and again by the create
 * action when it refuses a submission, so a rejected form comes back holding everything that
 * was typed with an issue beside each field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { Button, Form, Input, Switch, TextField } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { ScopeMonitorGroup } from "~/app/services/scope-monitors";

import { getViewer } from "~/app/http/middleware/auth";
import { fieldIssue, submittedChecked, submittedText } from "~/app/http/validators/form-submission";
import { TEAM_WIDE_MONITOR_SCOPE } from "~/app/services/monitor-scope";
import { withPrefix } from "~/app/services/prefixed-translate";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import MonitorScopeField from "~/resources/components/monitor-scope-field";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export namespace NewMaintenanceWindowPage {
	export interface Props {
		/** The team's monitors grouped by kind, offered as the window's coverage. */
		scopeGroups: ScopeMonitorGroup[];
		/** The submission the create action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function NewMaintenanceWindowPage(handle: Handle<NewMaintenanceWindowPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { scopeGroups, submission } = handle.props;

		/** Shares its field copy with the edit page by reading the same maintenance-window form namespace. */
		let t = withPrefix(ctx.intl.t, "page.maintenanceWindows.form.fields");
		let startsIssue = fieldIssue(submission, "starts_at");
		let endsIssue = fieldIssue(submission, "ends_at");

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.createMaintenance.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.maintenanceWindows.new.href({ team: ctx.team.slug })}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.createMaintenance.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.maintenance"),
							href: routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<Form
							method="post"
							action={routes.actions.maintenanceWindow.create.href({ team: ctx.team.slug })}
							issues={submission?.issues}
						>
							<div mix={[vstack({ gap: 12 })]}>
								<SettingsSection
									id="coverage"
									title={ctx.intl.t("page.createMaintenance.form.sections.coverage.title")}
									description={ctx.intl.t(
										"page.createMaintenance.form.sections.coverage.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<TextField
												label={t("name.label")}
												type="text"
												name="name"
												required
												defaultValue={submittedText(submission, "name", "")}
											/>

											<MonitorScopeField
												groups={scopeGroups}
												selected={TEAM_WIDE_MONITOR_SCOPE}
												description={t("scope.description")}
												intl={ctx.intl}
												submission={submission}
											/>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="schedule"
									title={ctx.intl.t("page.createMaintenance.form.sections.schedule.title")}
									description={ctx.intl.t(
										"page.createMaintenance.form.sections.schedule.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<Field
												label={t("startsAt.label")}
												error={startsIssue}
												errorId="maintenance-window-starts-at-error"
											>
												<Input
													id="maintenance-window-starts-at"
													type="datetime-local"
													name="starts_at"
													required
													defaultValue={submittedText(submission, "starts_at", "")}
													aria-invalid={startsIssue ? "true" : undefined}
													aria-describedby={
														startsIssue ? "maintenance-window-starts-at-error" : undefined
													}
												/>
											</Field>

											<Field
												label={t("endsAt.label")}
												error={endsIssue}
												errorId="maintenance-window-ends-at-error"
											>
												<Input
													id="maintenance-window-ends-at"
													type="datetime-local"
													name="ends_at"
													required
													defaultValue={submittedText(submission, "ends_at", "")}
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
									title={ctx.intl.t("page.createMaintenance.form.sections.behavior.title")}
									description={ctx.intl.t(
										"page.createMaintenance.form.sections.behavior.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<div mix={[vstack({ gap: SETTINGS_SWITCH_GAP })]}>
												<Switch
													name="suppress_alerts"
													value="true"
													defaultChecked={submittedChecked(submission, "suppress_alerts", true)}
												>
													{t("suppressAlerts.label")}
												</Switch>

												<Switch
													name="show_on_status_page"
													value="true"
													defaultChecked={submittedChecked(submission, "show_on_status_page", true)}
												>
													{t("showOnStatusPage.label")}
												</Switch>

												<Switch
													name="is_recurring"
													value="true"
													defaultChecked={submittedChecked(submission, "is_recurring", false)}
												>
													{t("recurring.label")}
												</Switch>
											</div>

											<TextField
												label={t("recurringPattern.label")}
												name="recurring_pattern"
												defaultValue={submittedText(submission, "recurring_pattern", "")}
												placeholder={t("recurringPattern.placeholder")}
												description={t("recurringPattern.description")}
											/>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<Button type="submit">{ctx.intl.t("page.createMaintenance.form.cta")}</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</div>
						</Form>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
