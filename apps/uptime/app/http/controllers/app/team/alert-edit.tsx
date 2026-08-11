/**
 * Edit alert page controller. Requires `requireUser` + `requireTeam`; 404s when the
 * alert doesn't belong to the current team.
 *
 * The fields are grouped into bordered cards — what the alert watches, where it
 * notifies, and how often it may repeat — each with its own heading and description,
 * so the page reads as distinct settings groups rather than one continuous column.
 * They all stay inside the single `<form>` that posts to `update-alert`, so a
 * submission carries exactly the same fields it always did; only the last card owns
 * the action row. The destructive action gets a second, danger-toned section below,
 * on its own `<form>`.
 *
 * Most of the field markup is written out here rather than pulled from a shared view:
 * a view that had to render either as one block or as three separately-carded groups
 * would exist only to carry that difference between its two callers. The channel card
 * is the exception: its contents match the create page's down to the last attribute,
 * differing only in being prefilled, so they come from `AlertChannelFields`, which also
 * owns the CSS-only disclosure that shows one channel's settings at a time.
 *
 * The danger-zone delete confirmation is `@pkg/ui`'s `AlertDialog` composed
 * directly rather than through the `Confirm` convenience wrapper, since the
 * confirming control is a real `<form method="post">` submit button rather than a
 * `command="close"` action.
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
import { AlertDialog, Button, Input, LinkButton, Switch, TextField } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Alert from "~/app/data/alert";
import { listScopeMonitors } from "~/app/data/alert-scope-monitors";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { DEFAULT_COOLDOWN_MINUTES, MIN_REPEAT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import { storedAlertScope } from "~/app/lib/alert-scope";
import AlertChannelFields from "~/resources/components/alert-channel-fields";
import AlertScopeField from "~/resources/components/alert-scope-field";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
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

		// Same fixed namespace the create page reads, so both pages label the fields identically.
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

											<AlertScopeField
												groups={scopeGroups}
												selected={storedAlertScope(alert)}
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
													 * {@link MIN_REPEAT_COOLDOWN_MINUTES}. Raising it would make every alert already
													 * storing a smaller value unsaveable — the field is prefilled from the row, so
													 * the form would refuse to submit until somebody noticed why. The floor is
													 * enforced at dispatch, where it reaches stored rows too, and the description
													 * says so.
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
