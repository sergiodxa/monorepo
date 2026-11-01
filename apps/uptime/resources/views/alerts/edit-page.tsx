/**
 * The edit alert page, drawn by the edit route and again by the update action when it refuses
 * a submission, so a rejected form comes back holding everything that was typed with an issue
 * beside each field to fix. Deleting sits last, behind a confirmation dialog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, Form, Input, LinkButton, Switch, TextField } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { ScopeMonitorGroup } from "~/app/services/scope-monitors";
import type { SelectAlert } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import { fieldIssue, submittedChecked, submittedText } from "~/app/http/validators/form-submission";
import {
	DEFAULT_COOLDOWN_MINUTES,
	MIN_REPEAT_COOLDOWN_MINUTES,
} from "~/app/services/alerts/policy";
import { storedMonitorScope } from "~/app/services/monitor-scope";
import { withPrefix } from "~/app/services/prefixed-translate";
import AlertChannelFields from "~/resources/components/alert-channel-fields";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import MonitorScopeField from "~/resources/components/monitor-scope-field";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DELETE_ALERT_DIALOG_ID = "delete-alert";
const DELETE_ALERT_TITLE_ID = "delete-alert-title";
const DELETE_ALERT_DESCRIPTION_ID = "delete-alert-description";

/** `id` of the cooldown's error, which the input names in `aria-describedby`. */
const COOLDOWN_ERROR_ID = "alert-cooldown-error";

export namespace EditAlertPage {
	export interface Props {
		alert: SelectAlert;
		/** The team's monitors grouped by kind, offered as the alert's scope. */
		scopeGroups: ScopeMonitorGroup[];
		/** The submission the update action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function EditAlertPage(handle: Handle<EditAlertPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { alert, scopeGroups, submission } = handle.props;

		/** Same fixed namespace the create page reads, so both pages label fields identically. */
		let t = withPrefix(ctx.intl.t, "page.alerts.form.fields");
		let indexHref = routes.app.team.alerts.index.href({ team: ctx.team.slug });
		let heading = ctx.intl.t("page.editAlert.header.named", { name: alert.name });
		let cooldownIssue = fieldIssue(submission, "cooldown_minutes");

		return (
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${heading}`}>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.alerts.edit.href({ team: ctx.team.slug, alertId: alert.id })}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={heading}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.alerts"),
							href: indexHref,
						},
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<Form
								method="post"
								action={routes.actions.alert.update.href({ team: ctx.team.slug })}
								issues={submission?.issues}
							>
								<input type="hidden" name="alert_id" value={alert.id} />

								<div mix={[vstack({ gap: 12 })]}>
									<SettingsSection
										id="basics"
										title={ctx.intl.t("page.editAlert.form.sections.basics.title")}
										description={ctx.intl.t("page.editAlert.form.sections.basics.description")}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												<TextField
													label={t("name.label")}
													name="name"
													required
													defaultValue={submittedText(submission, "name", alert.name)}
												/>

												<MonitorScopeField
													groups={scopeGroups}
													selected={storedMonitorScope(alert)}
													description={t("scope.description")}
													intl={ctx.intl}
													submission={submission}
												/>
											</SettingsSection.Body>
										</SettingsSection.Card>
									</SettingsSection>

									<SettingsSection
										id="channel"
										title={ctx.intl.t("page.editAlert.form.sections.channel.title")}
										description={ctx.intl.t("page.editAlert.form.sections.channel.description")}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												<AlertChannelFields
													intl={ctx.intl}
													config={alert.config}
													submission={submission}
												/>
											</SettingsSection.Body>
										</SettingsSection.Card>
									</SettingsSection>

									<SettingsSection
										id="delivery"
										title={ctx.intl.t("page.editAlert.form.sections.delivery.title")}
										description={ctx.intl.t("page.editAlert.form.sections.delivery.description")}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												<Switch
													name="notify_on_recovery"
													value="true"
													defaultChecked={submittedChecked(
														submission,
														"notify_on_recovery",
														alert.notify_on_recovery,
													)}
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
														 * `min` stays 0 even though a repeat is never spaced closer than
														 * {@link MIN_REPEAT_COOLDOWN_MINUTES}: raising it would make alerts already
														 * storing a smaller value unsaveable. The floor is enforced at dispatch instead.
														 */
														min={0}
														max={1440}
														defaultValue={submittedText(
															submission,
															"cooldown_minutes",
															String(alert.cooldown_minutes ?? DEFAULT_COOLDOWN_MINUTES),
														)}
														aria-invalid={cooldownIssue ? "true" : undefined}
														aria-describedby={cooldownIssue ? COOLDOWN_ERROR_ID : undefined}
													/>
												</Field>
											</SettingsSection.Body>
											<SettingsSection.Footer>
												<LinkButton variant="outline" href={indexHref}>
													{ctx.intl.t("page.editAlert.form.cancel")}
												</LinkButton>
												<Button type="submit">{ctx.intl.t("page.editAlert.form.cta")}</Button>
											</SettingsSection.Footer>
										</SettingsSection.Card>
									</SettingsSection>
								</div>
							</Form>
							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.intl.t("page.editAlert.danger.title")}
								description={ctx.intl.t("page.editAlert.danger.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.intl.t("page.editAlert.danger.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_ALERT_DIALOG_ID}
											command="show-modal"
										>
											{ctx.intl.t("page.editAlert.danger.delete.trigger")}
										</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>

							<AlertDialog
								id={DELETE_ALERT_DIALOG_ID}
								aria-labelledby={DELETE_ALERT_TITLE_ID}
								aria-describedby={DELETE_ALERT_DESCRIPTION_ID}
							>
								<AlertDialog.Header>
									<AlertDialog.Title id={DELETE_ALERT_TITLE_ID}>
										{ctx.intl.t("app.confirm.deleteAlert.title", { name: alert.name })}
									</AlertDialog.Title>
									<AlertDialog.Description id={DELETE_ALERT_DESCRIPTION_ID}>
										{ctx.intl.t("page.editAlert.danger.warning")}
									</AlertDialog.Description>
								</AlertDialog.Header>
								<form
									method="post"
									action={routes.actions.alert.delete.href({ team: ctx.team.slug })}
								>
									<input type="hidden" name="_method" value="DELETE" />
									<input type="hidden" name="alert_id" value={alert.id} />
									<AlertDialog.Footer>
										<AlertDialog.Cancel type="button" commandfor={DELETE_ALERT_DIALOG_ID}>
											{ctx.intl.t("page.editAlert.form.cancel")}
										</AlertDialog.Cancel>
										<Button type="submit" color="danger">
											{ctx.intl.t("page.editAlert.danger.delete.trigger")}
										</Button>
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
