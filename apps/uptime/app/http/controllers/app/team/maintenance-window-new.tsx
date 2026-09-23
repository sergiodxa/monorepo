/**
 * New maintenance window page controller. Requires `requireUser` + `requireTeam`.
 * Fields are grouped into three bordered cards — coverage, schedule, and behavior —
 * inside one `<form>`, with the submit control anchored to the last card's footer.
 * The scope picker comes from `MonitorScopeField`, the one control that offers every
 * monitor of every type plus a per-type "all of them" choice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { Button, Input, Label, Switch, TextField } from "@sdxc/ui";
import { fieldStackLayout } from "@sdxc/ui/styles";
import { createAction } from "remix/router";

import { listScopeMonitors } from "~/app/data/scope-monitors";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { TEAM_WIDE_MONITOR_SCOPE } from "~/app/lib/monitor-scope";
import { withPrefix } from "~/app/lib/prefixed-translate";
import FormPage from "~/resources/components/form-page";
import MonitorScopeField from "~/resources/components/monitor-scope-field";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/maintenance/new — the new maintenance-window form. */
export default createAction(routes.app.team.maintenanceWindows.new, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let scopeGroups = await listScopeMonitors(ctx.db, ctx.team.id);

		/** Shares its field copy with the edit page by reading the same maintenance-window form namespace. */
		let t = withPrefix(ctx.intl.t, "page.maintenanceWindows.form.fields");

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.intl.t("page.createMaintenance.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
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
						<form
							method="post"
							action={routes.actions.maintenanceWindow.create.href({ team: ctx.team.slug })}
							mix={[vstack({ gap: 12 })]}
						>
							<SettingsSection
								id="coverage"
								title={ctx.intl.t("page.createMaintenance.form.sections.coverage.title")}
								description={ctx.intl.t(
									"page.createMaintenance.form.sections.coverage.description",
								)}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TextField label={t("name.label")} type="text" name="name" required />

										<MonitorScopeField
											groups={scopeGroups}
											selected={TEAM_WIDE_MONITOR_SCOPE}
											description={t("scope.description")}
											intl={ctx.intl}
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
										<div mix={[fieldStackLayout()]}>
											<Label htmlFor="maintenance-window-starts-at">{t("startsAt.label")}</Label>
											<Input
												id="maintenance-window-starts-at"
												type="datetime-local"
												name="starts_at"
												required
											/>
										</div>

										<div mix={[fieldStackLayout()]}>
											<Label htmlFor="maintenance-window-ends-at">{t("endsAt.label")}</Label>
											<Input
												id="maintenance-window-ends-at"
												type="datetime-local"
												name="ends_at"
												required
											/>
										</div>
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
											<Switch name="suppress_alerts" value="true" defaultChecked>
												{t("suppressAlerts.label")}
											</Switch>

											<Switch name="show_on_status_page" value="true" defaultChecked>
												{t("showOnStatusPage.label")}
											</Switch>

											<Switch name="is_recurring" value="true">
												{t("recurring.label")}
											</Switch>
										</div>

										<TextField
											label={t("recurringPattern.label")}
											name="recurring_pattern"
											defaultValue=""
											placeholder={t("recurringPattern.placeholder")}
											description={t("recurringPattern.description")}
										/>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.intl.t("page.createMaintenance.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
