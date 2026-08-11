/**
 * Edit cron-job monitor page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * The fields are framed as three bordered cards — what the job is, when it is
 * expected, and what happens when a run doesn't arrive — with the action row at the
 * foot of the last one, so the page reads as distinct settings groups rather than one
 * continuous column. All three cards still sit inside the same `<form>`, so the update
 * still posts every field in a single request. The delete form stays its own
 * `<form method="post">` with its own `_method=DELETE`, inside the confirmation dialog.
 *
 * The field markup is spelled out here rather than pulled from the shared create/edit
 * view, because that view renders the fields as one flat run and only this page splits
 * them across cards; inlining keeps the grouping at the call site instead of pushing a
 * layout concern into a view the create page also renders.
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
import { AlertDialog, Button, LinkButton, Select, Switch, TextField } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { DEFAULT_TIMEZONE, groupedTimezones, isSupportedTimezone } from "~/app/lib/timezones";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import StepperField from "~/resources/components/stepper-field";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Stable id for the delete-confirmation `AlertDialog`, wired to its trigger's `commandfor`. */
const DELETE_DIALOG_ID = "delete-cron-job";

/** Stable id linking the grace-period field's label to its number input. */
const GRACE_PERIOD_INPUT_ID = "cron-job-grace-period-seconds";

/** GET /app/:team/cron-jobs/:monitorId/edit — a cron-job monitor's edit form. */
export default createAction(routes.app.team.cronJobs.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await CronJobMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let t = ctx.i18next.getFixedT(null, "translation", "page.editCronJob");
		let fields = ctx.i18next.getFixedT(null, "translation", "page.editCronJob.form.fields");

		/*
		 * The picker offers the zones this runtime knows plus the job's own stored value
		 * when that isn't among them. Without the second half an unrecognised stored zone
		 * would match no option, the browser would fall back to the first one, and saving
		 * any unrelated field would quietly move the job to a different wall clock — the
		 * failure a `<select>` makes silent. Shown but unsaveable is the right trade: the
		 * validator rejects it with a message instead of overwriting it without one.
		 */
		let timezone = monitor.timezone ?? DEFAULT_TIMEZONE;
		let hasUnknownTimezone = !isSupportedTimezone(timezone);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${t("header.title")} ${monitor.name}`}>
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
						{
							label: monitor.name,
							href: routes.app.team.cronJobs.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							}),
						},
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.cronJob.update.href({ team: ctx.team.slug })}
								mix={[vstack({ gap: 12 })]}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

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
												defaultValue={monitor.name}
												placeholder={fields("name.placeholder")}
												description={fields("name.description")}
											/>

											<TextField
												label={fields("description.label")}
												type="text"
												name="description"
												defaultValue={monitor.description ?? ""}
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
												defaultValue={monitor.cron_expression ?? ""}
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
												defaultValue={monitor.grace_period_seconds ?? 300}
											/>

											<Field
												label={fields("timezone.label")}
												description={fields("timezone.description")}
											>
												{/*
												 * The saved zone is marked `selected` on its own `<option>`: `<select>` has no
												 * `defaultValue` attribute, so spelling it on the host renders as inert markup
												 * and leaves the first option showing, which a save would then write back over
												 * the zone the job actually runs in.
												 *
												 * UTC leads the list on its own because the IANA enumeration does not contain
												 * it; see `app/lib/timezones.ts` for why that exception exists.
												 */}
												<Select name="timezone" required>
													{hasUnknownTimezone && (
														<Select.Option value={timezone} selected>
															{timezone}
														</Select.Option>
													)}
													<Select.Option
														value={DEFAULT_TIMEZONE}
														selected={timezone === DEFAULT_TIMEZONE}
													>
														{DEFAULT_TIMEZONE}
													</Select.Option>
													{groupedTimezones().map((group) => (
														<Select.Group key={group.region} label={group.region}>
															{group.zones.map((zone) => (
																<Select.Option key={zone} value={zone} selected={zone === timezone}>
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
												<Switch
													name="alert_on_late"
													value="true"
													defaultChecked={monitor.alert_on_late ?? false}
												>
													{fields("alertOnLate.label")}
												</Switch>

												<Switch
													name="is_enabled"
													value="true"
													defaultChecked={monitor.enabled_at !== null}
												>
													{fields("enabled.label")}
												</Switch>
											</div>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton
												variant="outline"
												href={routes.app.team.cronJobs.show.href({
													team: ctx.team.slug,
													monitorId: monitor.id,
												})}
											>
												{t("form.cancel")}
											</LinkButton>
											<Button type="submit">{t("form.cta")}</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							<SettingsSection
								id="danger"
								tone="danger"
								title={t("danger.title")}
								description={t("danger.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>{t("danger.warning")}</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_DIALOG_ID}
											command="show-modal"
										>
											{t("danger.delete.trigger")}
										</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>

							<AlertDialog
								id={DELETE_DIALOG_ID}
								aria-labelledby={`${DELETE_DIALOG_ID}-title`}
								aria-describedby={`${DELETE_DIALOG_ID}-description`}
							>
								<AlertDialog.Header>
									<AlertDialog.Title id={`${DELETE_DIALOG_ID}-title`}>
										{t("danger.delete.confirmTitle")}
									</AlertDialog.Title>
									<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
										{t("danger.delete.confirmDescription")}
									</AlertDialog.Description>
								</AlertDialog.Header>
								<form
									method="post"
									action={routes.actions.cronJob.delete.href({ team: ctx.team.slug })}
								>
									<input type="hidden" name="_method" value="DELETE" />
									<input type="hidden" name="monitor_id" value={monitor.id} />
									<AlertDialog.Footer>
										<AlertDialog.Cancel commandfor={DELETE_DIALOG_ID}>
											{t("form.cancel")}
										</AlertDialog.Cancel>
										<Button type="submit" color="danger">
											{t("danger.delete.confirm")}
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
