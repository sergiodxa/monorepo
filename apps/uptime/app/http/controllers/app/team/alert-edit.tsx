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
 * The field markup is written out here rather than pulled from a shared view: the
 * create page draws the same fields as one uninterrupted block, and a view that had
 * to render either as one block or as three separately-carded groups would exist only
 * to carry that difference between its two callers.
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
import { m, mbe } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { AlertDialog, Button, Input, LinkButton, Select, Switch, TextField } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Alert from "~/app/data/alert";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { DEFAULT_COOLDOWN_MINUTES, MIN_REPEAT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DELETE_ALERT_DIALOG_ID = "delete-alert";
const DELETE_ALERT_TITLE_ID = "delete-alert-title";
const DELETE_ALERT_DESCRIPTION_ID = "delete-alert-description";

/** Splits a translated string containing exactly one `<code>...</code>` span into plain text plus a `<code>` node. */
function renderInlineCode(text: string) {
	let match = /^(.*)<code>(.*)<\/code>(.*)$/s.exec(text);
	if (!match) return text;
	let [, before, code, after] = match;
	return (
		<>
			{before}
			<code>{code}</code>
			{after}
		</>
	);
}

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

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

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
												mix={[mbe("28px")]}
											/>

											<Field label={t("scope.label")}>
												<Select name="monitor_id" defaultValue={alert.monitor_id ?? ""}>
													<Select.Option value="">{t("scope.teamWide")}</Select.Option>
													{monitors.map((monitor) => (
														<Select.Option key={monitor.id} value={monitor.id}>
															{monitor.name} (HTTP)
														</Select.Option>
													))}
												</Select>
											</Field>
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
											<Field label={t("channel.label")}>
												<Select name="strategy" defaultValue={config?.strategy ?? "email"}>
													<Select.Option value="email">{t("channel.options.email")}</Select.Option>
													<Select.Option value="webhook">
														{t("channel.options.webhook")}
													</Select.Option>
													<Select.Option value="slack">{t("channel.options.slack")}</Select.Option>
													<Select.Option value="discord">
														{t("channel.options.discord")}
													</Select.Option>
												</Select>
											</Field>

											<fieldset mix={[mbe("28px")]}>
												<legend>{t("legends.email")}</legend>
												<TextField
													label={t("config.email.to.label")}
													type="email"
													name="email_to"
													defaultValue={config?.strategy === "email" ? config.config.to : ""}
													mix={[mbe("28px")]}
												/>
												<TextField
													label={t("config.email.subjectPrefix.label")}
													name="email_subject_prefix"
													defaultValue={
														config?.strategy === "email" ? config.config.subjectPrefix : ""
													}
												/>
											</fieldset>

											<fieldset mix={[mbe("28px")]}>
												<legend>{t("legends.webhook")}</legend>
												<TextField
													label={t("config.webhook.url.label")}
													type="url"
													name="webhook_url"
													defaultValue={config?.strategy === "webhook" ? config.config.url : ""}
													mix={[mbe("28px")]}
												/>
												<TextField
													label={t("config.webhook.secret.label")}
													name="webhook_secret"
													defaultValue={config?.strategy === "webhook" ? config.config.secret : ""}
													mix={[mbe("28px")]}
												/>
												<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
													{renderInlineCode(t("config.webhook.signatureNote"))}
												</p>
											</fieldset>

											<fieldset mix={[mbe("28px")]}>
												<legend>{t("legends.slack")}</legend>
												<TextField
													label={t("config.slack.webhookUrl.label")}
													type="url"
													name="slack_webhook_url"
													defaultValue={
														config?.strategy === "slack" ? config.config.webhookUrl : ""
													}
													mix={[mbe("28px")]}
												/>
												<TextField
													label={t("config.slack.channel.label")}
													name="slack_channel"
													placeholder="#incidents"
													defaultValue={
														config?.strategy === "slack" ? (config.config.channel ?? "") : ""
													}
												/>
											</fieldset>

											<fieldset mix={[mbe("28px")]}>
												<legend>{t("legends.discord")}</legend>
												<TextField
													label={t("config.discord.webhookUrl.label")}
													type="url"
													name="discord_webhook_url"
													defaultValue={
														config?.strategy === "discord" ? config.config.webhookUrl : ""
													}
												/>
											</fieldset>
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
											{/* The switch carries no trailing margin of its own, unlike every `Field` around it. */}
											<div mix={[mbe("28px")]}>
												<Switch
													name="notify_on_recovery"
													value="true"
													defaultChecked={alert.notify_on_recovery}
												>
													{t("notifyOnRecovery.label")}
												</Switch>
											</div>

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
										<p mix={[m(0), mbe("28px"), fontSize("sm"), fg("danger")]}>
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
