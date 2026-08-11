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
import { mbe } from "@pkg/u/size";
import { Button, Switch, TextField } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
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
											mix={mbe("28px")}
										/>

										<TextField
											label={fields("description.label")}
											type="text"
											name="description"
											defaultValue=""
											placeholder={fields("description.placeholder")}
											description={fields("description.description")}
											mix={mbe("28px")}
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
											mix={mbe("28px")}
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

										<TextField
											label={fields("timezone.label")}
											type="text"
											name="timezone"
											required
											defaultValue="UTC"
											placeholder={fields("timezone.placeholder")}
											description={fields("timezone.description")}
											mix={mbe("28px")}
										/>
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
										{/* The two switches carry no trailing margin of their own, so the group wrapper supplies the card's field rhythm. */}
										<div mix={[vstack({ gap: 4 }), mbe("28px")]}>
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
