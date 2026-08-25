/**
 * New alert page controller. Requires `requireUser` + `requireTeam`.
 *
 * The fields sit in three bordered cards — scope, channel, and delivery —
 * inside one `<form>`, with the submit control anchored to the last card's
 * footer; the channel card comes from `AlertChannelFields`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { vstack } from "@pkg/u/layout";
import { Button, Input, Switch, TextField } from "@pkg/ui";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { listScopeMonitors } from "~/app/data/scope-monitors";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { DEFAULT_COOLDOWN_MINUTES, MIN_REPEAT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import { TEAM_WIDE_MONITOR_SCOPE } from "~/app/lib/monitor-scope";
import AlertChannelFields from "~/resources/components/alert-channel-fields";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import MonitorScopeField from "~/resources/components/monitor-scope-field";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * GET /app/:team/alerts/new — the new alert form.
 *
 * Field copy comes from `page.alerts.form.fields`, shared with the edit page's form.
 */
export default createAction(routes.app.team.alerts.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let scopeGroups = await listScopeMonitors(db, ctx.team.id);

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
					i18next={ctx.i18next}
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
										<TextField label={t("name.label")} name="name" required />

										<MonitorScopeField
											groups={scopeGroups}
											selected={TEAM_WIDE_MONITOR_SCOPE}
											description={t("scope.description")}
											i18next={ctx.i18next}
										/>
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
										<AlertChannelFields i18next={ctx.i18next} />
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
												 * Raising `min` above 0 would block saving any alert already stored below
												 * {@link MIN_REPEAT_COOLDOWN_MINUTES}, since this field is prefilled from the
												 * row; dispatch enforces the real floor on every stored value regardless.
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
