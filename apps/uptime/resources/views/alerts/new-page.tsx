/**
 * The new alert page, drawn by the form's GET route and again by the create action when it
 * refuses a submission, so a rejected form comes back holding everything that was typed with
 * an issue beside each field to fix. Fields sit in three sections inside one form.
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
import {
	DEFAULT_COOLDOWN_MINUTES,
	MIN_REPEAT_COOLDOWN_MINUTES,
} from "~/app/services/alerts/policy";
import { TEAM_WIDE_MONITOR_SCOPE } from "~/app/services/monitor-scope";
import { withPrefix } from "~/app/services/prefixed-translate";
import AlertChannelFields from "~/resources/components/alert-channel-fields";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import MonitorScopeField from "~/resources/components/monitor-scope-field";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** `id` of the cooldown's error, which the input names in `aria-describedby`. */
const COOLDOWN_ERROR_ID = "alert-cooldown-error";

export namespace NewAlertPage {
	export interface Props {
		/** The team's monitors grouped by kind, offered as the alert's scope. */
		scopeGroups: ScopeMonitorGroup[];
		/** The submission the create action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/**
 * Renders the whole document for the current request's team and signed-in viewer. Field copy
 * comes from `page.alerts.form.fields`, shared with the edit page's form.
 */
export default function NewAlertPage(handle: Handle<NewAlertPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { scopeGroups, submission } = handle.props;

		let t = withPrefix(ctx.intl.t, "page.alerts.form.fields");
		let indexHref = routes.app.team.alerts.index.href({ team: ctx.team.slug });
		let cooldownIssue = fieldIssue(submission, "cooldown_minutes");

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.createAlert.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.alerts.new.href({ team: ctx.team.slug })}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.createAlert.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.alerts"),
							href: indexHref,
						},
					]}
				>
					<FormPage>
						<Form
							method="post"
							action={routes.actions.alert.create.href({ team: ctx.team.slug })}
							issues={submission?.issues}
						>
							<div mix={[vstack({ gap: 12 })]}>
								<SettingsSection
									id="basics"
									title={ctx.intl.t("page.createAlert.form.sections.basics.title")}
									description={ctx.intl.t("page.createAlert.form.sections.basics.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<TextField
												label={t("name.label")}
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
									id="channel"
									title={ctx.intl.t("page.createAlert.form.sections.channel.title")}
									description={ctx.intl.t("page.createAlert.form.sections.channel.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<AlertChannelFields intl={ctx.intl} submission={submission} />
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="delivery"
									title={ctx.intl.t("page.createAlert.form.sections.delivery.title")}
									description={ctx.intl.t("page.createAlert.form.sections.delivery.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<Switch
												name="notify_on_recovery"
												value="true"
												defaultChecked={submittedChecked(submission, "notify_on_recovery", true)}
											>
												{t("notifyOnRecovery.label")}
											</Switch>

											<Field
												label={t("cooldownMinutes.label")}
												description={t("cooldownMinutes.description", {
													floor: MIN_REPEAT_COOLDOWN_MINUTES,
												})}
												error={cooldownIssue}
												errorId={COOLDOWN_ERROR_ID}
											>
												<Input
													type="number"
													name="cooldown_minutes"
													/**
													 * Raising `min` above 0 would block saving any alert already stored below
													 * {@link MIN_REPEAT_COOLDOWN_MINUTES}, since this field is prefilled from the
													 * row; dispatch enforces the real floor on every stored value regardless.
													 */
													min={0}
													max={1440}
													defaultValue={submittedText(
														submission,
														"cooldown_minutes",
														String(DEFAULT_COOLDOWN_MINUTES),
													)}
													aria-invalid={cooldownIssue ? "true" : undefined}
													aria-describedby={cooldownIssue ? COOLDOWN_ERROR_ID : undefined}
												/>
											</Field>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<Button type="submit">{ctx.intl.t("page.alerts.form.cta")}</Button>
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
