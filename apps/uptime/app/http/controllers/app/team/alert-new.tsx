/**
 * New alert page controller. Requires `requireUser` + `requireTeam`.
 *
 * The fields are grouped into three bordered cards — what the alert watches, which
 * channel it notifies through, and how repeats are paced — inside a single `<form>`,
 * so the page reads as distinct settings groups while still submitting as one request.
 * The submit control sits at the foot of the last card rather than loose under the
 * fields.
 *
 * The field markup is spelled out here instead of coming from the shared alert field
 * component, because carding the form means rendering the fields across three separate
 * boxes and that component emits all of them as one fragment with no way to ask for a
 * subset. The edit page still renders it unchanged.
 *
 * All four channel fieldsets render together; the server only requires the fields for
 * the selected channel (see `app/http/validators/alert.ts`). Only HTTP monitors can be
 * individually targeted — the `alerts` table has no `monitor_type` column, so scoping to
 * a DNS/TCP/cron-job monitor could never be resolved back to the right table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { mbe } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { Button, Input, Select, Switch, TextField } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

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

/** GET /app/:team/alerts/new — the new alert form. */
export default createAction(routes.app.team.alerts.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		// The create and edit pages describe the same form, so the field copy lives in one
		// shared namespace instead of a per-page one.
		let t = ctx.i18next.getFixedT(null, "translation", "page.alerts.form.fields");

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.i18next.t("page.createAlert.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.createAlert.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.alerts"),
							href: routes.app.team.alerts.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.alert.create.href({ team: ctx.team.slug })}
							mix={[vstack({ gap: 12 })]}
						>
							<SettingsSection
								id="basics"
								title={ctx.i18next.t("page.createAlert.form.sections.basics.title")}
								description={ctx.i18next.t("page.createAlert.form.sections.basics.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TextField label={t("name.label")} name="name" required mix={[mbe("28px")]} />

										<Field label={t("scope.label")}>
											<Select name="monitor_id" defaultValue="">
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
								title={ctx.i18next.t("page.createAlert.form.sections.channel.title")}
								description={ctx.i18next.t("page.createAlert.form.sections.channel.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<Field label={t("channel.label")}>
											<Select name="strategy" defaultValue="email">
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
												defaultValue=""
												mix={[mbe("28px")]}
											/>
											<TextField
												label={t("config.email.subjectPrefix.label")}
												name="email_subject_prefix"
												defaultValue=""
											/>
										</fieldset>

										<fieldset mix={[mbe("28px")]}>
											<legend>{t("legends.webhook")}</legend>
											<TextField
												label={t("config.webhook.url.label")}
												type="url"
												name="webhook_url"
												defaultValue=""
												mix={[mbe("28px")]}
											/>
											<TextField
												label={t("config.webhook.secret.label")}
												name="webhook_secret"
												defaultValue=""
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
												defaultValue=""
												mix={[mbe("28px")]}
											/>
											<TextField
												label={t("config.slack.channel.label")}
												name="slack_channel"
												placeholder="#incidents"
												defaultValue=""
											/>
										</fieldset>

										<fieldset mix={[mbe("28px")]}>
											<legend>{t("legends.discord")}</legend>
											<TextField
												label={t("config.discord.webhookUrl.label")}
												type="url"
												name="discord_webhook_url"
												defaultValue=""
											/>
										</fieldset>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="delivery"
								title={ctx.i18next.t("page.createAlert.form.sections.delivery.title")}
								description={ctx.i18next.t("page.createAlert.form.sections.delivery.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<Switch name="notify_on_recovery" value="true" defaultChecked>
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
												defaultValue={DEFAULT_COOLDOWN_MINUTES}
											/>
										</Field>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.i18next.t("page.alerts.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
