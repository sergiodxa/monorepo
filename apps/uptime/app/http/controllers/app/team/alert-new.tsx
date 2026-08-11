/**
 * New alert page controller. Requires `requireUser` + `requireTeam`.
 *
 * The fields are grouped into three bordered cards — what the alert watches, which
 * channel it notifies through, and how repeats are paced — inside a single `<form>`,
 * so the page reads as distinct settings groups while still submitting as one request.
 * The submit control sits at the foot of the last card rather than loose under the
 * fields.
 *
 * Most of the field markup is spelled out here instead of coming from a shared fragment,
 * because carding the form means rendering the fields across three separate boxes and a
 * fragment that emitted all of them at once would have no way to be asked for a subset.
 * The channel card is the exception: its contents are identical to the edit page's down
 * to the last attribute, so they come from `AlertChannelFields`, which also owns the
 * CSS-only disclosure that shows one channel's settings at a time.
 *
 * The scope picker offers every monitor of every type, plus a per-type "all of them"
 * choice, from the one control `AlertScopeField` owns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { vstack } from "@pkg/u/layout";
import { Button, Input, Switch, TextField } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { listScopeMonitors } from "~/app/data/alert-scope-monitors";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { DEFAULT_COOLDOWN_MINUTES, MIN_REPEAT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import { TEAM_WIDE_ALERT_SCOPE } from "~/app/lib/alert-scope";
import AlertChannelFields from "~/resources/components/alert-channel-fields";
import AlertScopeField from "~/resources/components/alert-scope-field";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/alerts/new — the new alert form. */
export default createAction(routes.app.team.alerts.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let scopeGroups = await listScopeMonitors(db, ctx.team.id);

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

										<AlertScopeField
											groups={scopeGroups}
											selected={TEAM_WIDE_ALERT_SCOPE}
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
