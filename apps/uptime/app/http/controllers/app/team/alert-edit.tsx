/**
 * Edit alert page controller. Requires `requireUser` + `requireTeam`; 404s when the
 * alert doesn't belong to the current team. Fields sit in bordered cards inside one
 * `<form>` that posts to `update-alert`, so a submission always carries the same
 * fields. The delete confirmation composes `AlertDialog` directly because its
 * confirming control is a real form submit button.
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
import { AlertDialog, Button, Input, LinkButton, Switch, TextField } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Alert from "~/app/data/alert";
import { listScopeMonitors } from "~/app/data/scope-monitors";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { DEFAULT_COOLDOWN_MINUTES, MIN_REPEAT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import { storedMonitorScope } from "~/app/lib/monitor-scope";
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

/** GET /app/:team/alerts/:alertId/edit — an alert's edit form. */
export default createAction(routes.app.team.alerts.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { alertId } = s.parse(s.object({ alertId: s.string() }), ctx.params);
		let alert = await Alert.findByIdForTeam(db, ctx.team.id, alertId);
		if (!alert) return notFound("Not Found");

		let scopeGroups = await listScopeMonitors(db, ctx.team.id);

		/** Same fixed namespace the create page reads, so both pages label fields identically. */
		let t = ctx.i18next.getFixedT(null, "translation", "page.alerts.form.fields");
		let config = alert.config;
		let indexHref = routes.app.team.alerts.index.href({ team: ctx.team.slug });

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${alert.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.editAlert.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.alerts"),
							href: indexHref,
						},
						{ label: alert.name },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.alert.update.href({ team: ctx.team.slug })}
								mix={[vstack({ gap: 12 })]}
							>
								<input type="hidden" name="alert_id" value={alert.id} />

								<SettingsSection
									id="basics"
									title={ctx.i18next.t("page.editAlert.form.sections.basics.title")}
									description={ctx.i18next.t("page.editAlert.form.sections.basics.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<TextField
												label={t("name.label")}
												name="name"
												required
												defaultValue={alert.name}
											/>

											<MonitorScopeField
												groups={scopeGroups}
												selected={storedMonitorScope(alert)}
												description={t("scope.description")}
												i18next={ctx.i18next}
											/>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="channel"
									title={ctx.i18next.t("page.editAlert.form.sections.channel.title")}
									description={ctx.i18next.t("page.editAlert.form.sections.channel.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<AlertChannelFields i18next={ctx.i18next} config={config} />
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="delivery"
									title={ctx.i18next.t("page.editAlert.form.sections.delivery.title")}
									description={ctx.i18next.t("page.editAlert.form.sections.delivery.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<Switch
												name="notify_on_recovery"
												value="true"
												defaultChecked={alert.notify_on_recovery}
											>
												{t("notifyOnRecovery.label")}
											</Switch>

											<Field
												label={t("cooldownMinutes.label")}
												description={t("cooldownMinutes.description", {
													floor: MIN_REPEAT_COOLDOWN_MINUTES,
												})}
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
													defaultValue={alert.cooldown_minutes ?? DEFAULT_COOLDOWN_MINUTES}
												/>
											</Field>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton variant="outline" href={indexHref}>
												{ctx.i18next.t("page.editAlert.form.cancel")}
											</LinkButton>
											<Button type="submit">{ctx.i18next.t("page.editAlert.form.cta")}</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.i18next.t("page.editAlert.danger.title")}
								description={ctx.i18next.t("page.editAlert.danger.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.i18next.t("page.editAlert.danger.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_ALERT_DIALOG_ID}
											command="show-modal"
										>
											{ctx.i18next.t("page.editAlert.danger.delete.trigger")}
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
										{ctx.i18next.t("page.editAlert.danger.delete.confirmTitle")}
									</AlertDialog.Title>
									<AlertDialog.Description id={DELETE_ALERT_DESCRIPTION_ID}>
										{ctx.i18next.t("page.editAlert.danger.delete.confirmDescription")}
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
											{ctx.i18next.t("page.editAlert.form.cancel")}
										</AlertDialog.Cancel>
										<Button type="submit" color="danger">
											{ctx.i18next.t("page.editAlert.danger.delete.confirm")}
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
