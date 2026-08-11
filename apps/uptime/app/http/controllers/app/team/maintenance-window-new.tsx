/**
 * New maintenance window page controller. Requires `requireUser` + `requireTeam`.
 *
 * The fields are grouped into three bordered cards — what the window covers, when it
 * runs, and how it behaves while it is active — inside a single `<form>`, so the page
 * reads as distinct settings groups while still submitting as one request. The submit
 * control sits at the foot of the last card rather than loose under the fields.
 *
 * The field markup is written out here rather than reused from the shared
 * maintenance-window fields view: that view renders every field as one flat run, which
 * cannot be split across cards, and it is still rendered as-is by the edit page. Only
 * HTTP monitors can be individually targeted, matching alerts (see
 * `app/data/maintenance-window.ts`'s docblock).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { vstack } from "@pkg/u/layout";
import { Button, Input, Label, Select, Switch, TextField } from "@pkg/ui";
import { fieldStackLayout } from "@pkg/ui/styles";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/maintenance/new — the new maintenance-window form. */
export default createAction(routes.app.team.maintenanceWindows.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		// The field copy is shared with the edit page, so it is read from the
		// maintenance-window form namespace rather than this page's own.
		let t = ctx.i18next.getFixedT(null, "translation", "page.maintenanceWindows.form.fields");

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.i18next.t("page.createMaintenance.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.createMaintenance.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.maintenance"),
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
								title={ctx.i18next.t("page.createMaintenance.form.sections.coverage.title")}
								description={ctx.i18next.t(
									"page.createMaintenance.form.sections.coverage.description",
								)}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TextField label={t("name.label")} type="text" name="name" required />

										<Field label={t("scope.label")}>
											{/* The default is marked on the option, since `<select>` carries no `defaultValue` attribute. */}
											<Select name="monitor_id">
												<Select.Option value="" selected>
													{t("scope.allMonitors")}
												</Select.Option>
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
								id="schedule"
								title={ctx.i18next.t("page.createMaintenance.form.sections.schedule.title")}
								description={ctx.i18next.t(
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
								title={ctx.i18next.t("page.createMaintenance.form.sections.behavior.title")}
								description={ctx.i18next.t(
									"page.createMaintenance.form.sections.behavior.description",
								)}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										{/* The switches read as one group, so they sit on the tighter within-group rhythm. */}
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
										<Button type="submit">
											{ctx.i18next.t("page.createMaintenance.form.cta")}
										</Button>
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
