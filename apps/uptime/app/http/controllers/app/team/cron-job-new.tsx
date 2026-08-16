/**
 * New cron-job monitor page controller. Requires `requireUser` + `requireTeam`.
 *
 * The fields are framed as three bordered cards — what the job is, when it is
 * expected, and what happens when a run doesn't arrive — with the submit control at
 * the foot of the last one, so the page reads as distinct settings groups rather than
 * one continuous column. All three cards sit inside the same `<form>`, so creating
 * still posts every field in a single request.
 *
 * The field markup is spelled out here rather than pulled from the shared create/edit
 * view, because that view renders the fields as one flat run and only this page splits
 * them across cards; inlining keeps the grouping at the call site instead of pushing a
 * layout concern into a view another page also renders.
 *
 * The cron expression starts blank, forcing a deliberate choice instead of silently
 * scheduling an hourly job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@pkg/u/layout";
import { Button, Select, Switch, TextField } from "@pkg/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { DEFAULT_TIMEZONE, groupedTimezones } from "~/app/lib/timezones";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import StepperField from "~/resources/components/stepper-field";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Stable id linking the grace-period field's label to its number input. */
const GRACE_PERIOD_INPUT_ID = "cron-job-grace-period-seconds";

/** GET /app/:team/cron-jobs/new — the new cron-job monitor form. */
export default createAction(routes.app.team.cronJobs.new, {
	middleware: [requireUser, requireTeam],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let t = ctx.i18next.getFixedT(null, "translation", "page.createCronJob");
		let fields = ctx.i18next.getFixedT(null, "translation", "page.createCronJob.form.fields");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${t("header.title")}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={t("header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: t("header.breadcrumb.cronJobs"),
							href: routes.app.team.cronJobs.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.cronJob.create.href({ team: ctx.team.slug })}
							mix={[vstack({ gap: 12 })]}
						>
							<SettingsSection
								id="basics"
								title={t("form.sections.basics.title")}
								description={t("form.sections.basics.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TextField
											label={fields("name.label")}
											type="text"
											name="name"
											required
											placeholder={fields("name.placeholder")}
											description={fields("name.description")}
										/>

										<TextField
											label={fields("description.label")}
											type="text"
											name="description"
											defaultValue=""
											placeholder={fields("description.placeholder")}
											description={fields("description.description")}
										/>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="schedule"
								title={t("form.sections.schedule.title")}
								description={t("form.sections.schedule.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TextField
											label={fields("cronExpression.label")}
											type="text"
											name="cron_expression"
											required
											defaultValue=""
											placeholder={fields("cronExpression.placeholder")}
											description={fields("cronExpression.description")}
										/>

										<StepperField
											id={GRACE_PERIOD_INPUT_ID}
											name="grace_period_seconds"
											label={`${fields("gracePeriod.label")} (${fields("gracePeriod.unit.seconds")})`}
											decrementLabel={fields("gracePeriod.decrement")}
											incrementLabel={fields("gracePeriod.increment")}
											min={60}
											max={86_400}
											defaultValue={300}
										/>

										<Field
											label={fields("timezone.label")}
											description={fields("timezone.description")}
										>
											{/*
											 * The default is marked `selected` on its own `<option>`: `<select>` has
											 * no `defaultValue` attribute, so spelling it on the host renders as
											 * inert markup and the browser just keeps the first option — which here
											 * would happen to be the same zone only by accident of sort order.
											 *
											 * UTC leads the list on its own because the IANA enumeration doesn't
											 * contain it; see `app/lib/timezones.ts` for why that exception exists.
											 */}
											<Select name="timezone" required>
												<Select.Option value={DEFAULT_TIMEZONE} selected>
													{DEFAULT_TIMEZONE}
												</Select.Option>
												{groupedTimezones().map((group) => (
													<Select.Group key={group.region} label={group.region}>
														{group.zones.map((zone) => (
															<Select.Option key={zone} value={zone}>
																{zone}
															</Select.Option>
														))}
													</Select.Group>
												))}
											</Select>
										</Field>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="alerting"
								title={t("form.sections.alerting.title")}
								description={t("form.sections.alerting.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										{/* The two switches read as one group, so they sit on the tighter within-group rhythm. */}
										<div mix={[vstack({ gap: SETTINGS_SWITCH_GAP })]}>
											<Switch name="alert_on_late" value="true" defaultChecked={false}>
												{fields("alertOnLate.label")}
											</Switch>

											<Switch name="is_enabled" value="true" defaultChecked={true}>
												{fields("enabled.label")}
											</Switch>
										</div>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{t("form.cta")}</Button>
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
