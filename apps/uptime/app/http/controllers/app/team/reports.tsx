/**
 * Report builder page controller. Requires `requireUser` + `requireTeam`. The form is a
 * `GET` whose submit buttons point `formaction` at each report's download, or at a ZIP of
 * both, so choosing a range, monitors and format and pressing one downloads with no JavaScript.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { Alert, Button, DateField, LinkButton, RadioGroup, Select } from "@sdxc/ui";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { withPrefix } from "~/app/lib/prefixed-translate";
import { REPORT_DIALECTS } from "~/app/lib/report-dialect";
import { presetRange, REPORT_PRESETS } from "~/app/lib/report-range";
import { isSubmitted, REPORT_MONITOR_TYPES, resolveReportRequest } from "~/app/lib/report-request";
import { getYesterdayDateUtc } from "~/app/models/monitor-daily-stats";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * GET /app/:team/reports — the builder. A query the download rejected comes back here with
 * its fields intact and the problem above them, answered as 400; a first visit starts on last
 * month in the spreadsheet format.
 */
export default createAction(routes.app.team.reports.index, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let t = withPrefix(ctx.intl.t, "page.reports");
		let params = ctx.url.searchParams;
		let request = await resolveReportRequest(ctx.models, ctx.team.id, params);
		let problem = isFailure(request) && isSubmitted(params) ? request.error.problem : null;

		let fallback = presetRange("lastMonth");
		let values = isFailure(request)
			? {
					from: params.get("from") ?? fallback.from,
					to: params.get("to") ?? fallback.to,
					monitors: params.get("monitors") ?? "all",
					dialect: params.get("dialect") === "standard" ? "standard" : "spreadsheet",
				}
			: {
					from: request.data.range.from,
					to: request.data.range.to,
					monitors: request.data.monitors,
					dialect: request.data.dialect,
				};

		let statusPages = await ctx.models.statusPages
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();
		let yesterday = getYesterdayDateUtc();
		let team = ctx.team.slug;

		/**
		 * A preset keeps the monitors and format already chosen, so picking a range never
		 * resets the rest of the form.
		 */
		let presetHref = (range: { from: string; to: string }) => {
			let query = new URLSearchParams({
				...range,
				monitors: values.monitors,
				dialect: values.dialect,
			});
			return `${routes.app.team.reports.index.href({ team })}?${query}`;
		};

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${t("header.title")}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={t("header.title")}
				>
					<FormPage>
						<form
							method="get"
							action={routes.app.team.reports.download.href({ team, report: "uptime-summary" })}
							mix={[vstack({ gap: 12 })]}
						>
							<p mix={[fg("neutral.muted")]}>{t("header.description")}</p>

							{problem && (
								<Alert color="danger" live="polite">
									<Alert.Content>
										<Alert.Description>{t(`errors.${problem}`)}</Alert.Description>
									</Alert.Content>
								</Alert>
							)}

							<SettingsSection id="range" title={t("form.range.legend")}>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<div mix={[hstack({ gap: 4, align: "end" }), flexWrap("wrap")]}>
											<DateField
												label={t("form.range.from")}
												name="from"
												defaultValue={values.from}
												max={yesterday}
												required
											/>
											<DateField
												label={t("form.range.to")}
												name="to"
												defaultValue={values.to}
												max={yesterday}
												required
											/>
										</div>
										<div mix={[vstack({ gap: 2 })]}>
											<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
												{t("form.range.presets")}
											</p>
											<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
												{REPORT_PRESETS.map((preset) => (
													<LinkButton
														key={preset}
														href={presetHref(presetRange(preset))}
														size="sm"
														variant="outline"
														color="neutral"
													>
														{t(`form.presets.${preset}`)}
													</LinkButton>
												))}
											</div>
										</div>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection id="monitors" title={t("form.monitors.label")}>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<Field label={t("form.monitors.label")}>
											<Select name="monitors">
												<Select.Option value="all" selected={values.monitors === "all"}>
													{t("form.monitors.all")}
												</Select.Option>
												{statusPages.length > 0 && (
													<Select.Group label={t("form.monitors.statusPages")}>
														{statusPages.map((page) => (
															<Select.Option
																key={page.id}
																value={`status-page:${page.id}`}
																selected={values.monitors === `status-page:${page.id}`}
															>
																{page.name}
															</Select.Option>
														))}
													</Select.Group>
												)}
												<Select.Group label={t("form.monitors.types")}>
													{REPORT_MONITOR_TYPES.map((type) => (
														<Select.Option
															key={type}
															value={`type:${type}`}
															selected={values.monitors === `type:${type}`}
														>
															{t(`types.${type}`)}
														</Select.Option>
													))}
												</Select.Group>
											</Select>
										</Field>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection id="format" title={t("form.dialect.legend")}>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<RadioGroup name="dialect" aria-label={t("form.dialect.legend")}>
											{REPORT_DIALECTS.map((dialect) => (
												<RadioGroup.Radio
													key={dialect}
													value={dialect}
													defaultChecked={values.dialect === dialect}
												>
													<span mix={[vstack({ gap: 1 })]}>
														<span>{t(`form.dialect.${dialect}.label`)}</span>
														<span mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
															{t(`form.dialect.${dialect}.description`)}
														</span>
													</span>
												</RadioGroup.Radio>
											))}
										</RadioGroup>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<div mix={[hstack({ gap: 3 }), flexWrap("wrap")]}>
											<Button
												type="submit"
												formAction={routes.app.team.reports.download.href({
													team,
													report: "uptime-summary",
												})}
												title={t("form.submit.summaryDescription")}
											>
												{t("form.submit.summary")}
											</Button>
											<Button
												type="submit"
												variant="outline"
												color="neutral"
												formAction={routes.app.team.reports.download.href({
													team,
													report: "uptime-daily",
												})}
												title={t("form.submit.dailyDescription")}
											>
												{t("form.submit.daily")}
											</Button>
											<Button
												type="submit"
												variant="outline"
												color="neutral"
												formAction={routes.app.team.reports.archive.href({ team })}
												title={t("form.submit.archiveDescription")}
											>
												{t("form.submit.archive")}
											</Button>
										</div>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection id="about" title={t("about.title")}>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<p>{t("about.uptime")}</p>
										<p>{t("about.days")}</p>
										<p>{t("about.maintenance")}</p>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
			{ status: problem ? 400 : 200 },
		);
	},
});
