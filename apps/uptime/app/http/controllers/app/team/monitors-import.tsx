/**
 * `GET /app/:team/import-monitors` — paste a list of URLs, get one monitor per line.
 *
 * The create form is right for one monitor and wrong for thirty. An agency arriving with a
 * roster of client sites has no way to get them in other than repeating the same form once per
 * site, which is the single most tedious thing this product asks of exactly the customer it is
 * trying to win — and it is asked at the worst possible moment, before they have seen any value.
 *
 * Paste-a-list rather than CSV, competitor imports, or sitemap discovery, all of which were
 * considered first: this needs no column mapping, no third-party API, no per-vendor field
 * translation that breaks when a vendor changes theirs, and no new data model. It reuses the
 * same creation path the form uses, so an imported monitor is indistinguishable from a
 * hand-made one.
 *
 * It is also where an import's rejected lines are read: the action redirects back here with a
 * one-time report whenever any line did not become a monitor, so the reasons sit directly above
 * the box the corrected lines get pasted into. The box itself is left empty rather than
 * pre-filled with the rejected lines — a report is a description of what was pasted, and
 * re-submitting our summary of somebody's text as if it were their text is how a truncated line
 * turns into a monitor watching the wrong URL.
 *
 * The paste box and the cadence applied to every line it creates sit in two bordered cards
 * inside a single `<form>`, so the page reads as distinct settings groups while still
 * submitting as one request. The report is a reading of the *previous* submission rather than
 * an input to the next one, so it gets a section of its own above the form instead of being
 * folded into a form card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { Button, Table, TextArea } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import type { MonitorImportReport } from "~/app/http/validators/monitor-import";

import { MONITOR_IMPORT_REPORT } from "~/app/http/controllers/actions/monitors-import";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { IMPORT_INTERVAL, MAX_IMPORT_LINES } from "~/app/http/validators/monitor-import";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import { RangeSlider } from "~/resources/components/range-slider";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The flash the redirect-after-post pattern leaves behind for one render. */
interface Toast {
	intent: "success" | "error";
	message: string;
}

/** GET /app/:team/import-monitors — the bulk URL paste form, plus the last import's report. */
export default createAction(routes.app.team.monitorsImport, {
	middleware: [requireUser, requireTeam],
	handler: async () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let session = ctx.get(Session);
		let toast = session?.get("toast") as Toast | undefined;
		let report = session?.get(MONITOR_IMPORT_REPORT) as MonitorImportReport | undefined;

		return ctx.render(
			<DocumentLayout title={ctx.i18next.t("page.monitorsImport.meta.title")} locale={ctx.locale}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					toast={toast}
					heading={ctx.i18next.t("page.monitorsImport.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("page.httpMonitors.header.title"),
							href: routes.app.team.monitors.index.href({ team: ctx.team.slug }),
						},
						{ label: ctx.i18next.t("page.monitorsImport.header.title") },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							{/* The `id`s name the two regions of the report — the per-line table and the
							unexamined remainder — so what this page renders can be asserted on without
							depending on the copy inside them. The count of what *was* created leads the
							section as its description, so a partial import never reads as a failed one. */}
							{report && (report.rejected.length > 0 || report.overflow > 0) && (
								<SettingsSection
									id="import-report"
									title={ctx.i18next.t("page.monitorsImport.report.section.title")}
									description={ctx.i18next.t("page.monitorsImport.report.title", {
										count: report.created,
									})}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<div mix={[vstack({ gap: "12px" })]}>
												{report.rejected.length > 0 && (
													<Table.Container>
														<Table
															aria-label={ctx.i18next.t("page.monitorsImport.report.table.label")}
														>
															<Table.Header>
																<Table.Row>
																	<Table.Column>
																		{ctx.i18next.t("page.monitorsImport.report.table.columns.line")}
																	</Table.Column>
																	<Table.Column>
																		{ctx.i18next.t(
																			"page.monitorsImport.report.table.columns.input",
																		)}
																	</Table.Column>
																	<Table.Column>
																		{ctx.i18next.t(
																			"page.monitorsImport.report.table.columns.reason",
																		)}
																	</Table.Column>
																</Table.Row>
															</Table.Header>
															<Table.Body>
																{report.rejected.map((rejection) => (
																	<Table.Row key={`${rejection.line}`}>
																		<Table.Cell>{rejection.line}</Table.Cell>
																		<Table.Cell>
																			<code>{rejection.input}</code>
																		</Table.Cell>
																		<Table.Cell>
																			{ctx.i18next.t(
																				`page.monitorsImport.report.reasons.${rejection.reason}`,
																			)}
																		</Table.Cell>
																	</Table.Row>
																))}
															</Table.Body>
														</Table>
													</Table.Container>
												)}

												{report.overflow > 0 && (
													<p id="import-overflow" mix={[fg("neutral")]}>
														{ctx.i18next.t("page.monitorsImport.report.overflow", {
															count: report.overflow,
															limit: MAX_IMPORT_LINES,
														})}
													</p>
												)}
											</div>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>
							)}

							<form
								method="post"
								action={routes.actions.monitor.http.import.href({ team: ctx.team.slug })}
								mix={[vstack({ gap: 12 })]}
							>
								<SettingsSection
									id="urls"
									title={ctx.i18next.t("page.monitorsImport.form.sections.urls.title")}
									description={ctx.i18next.t("page.monitorsImport.form.sections.urls.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<Field
												label={ctx.i18next.t("page.monitorsImport.form.fields.urls.label")}
												description={ctx.i18next.t(
													"page.monitorsImport.form.fields.urls.description",
													{ limit: MAX_IMPORT_LINES },
												)}
											>
												<TextArea
													name="urls"
													required
													spellcheck={false}
													placeholder={ctx.i18next.t(
														"page.monitorsImport.form.fields.urls.placeholder",
													)}
												/>
											</Field>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="schedule"
									title={ctx.i18next.t("page.monitorsImport.form.sections.schedule.title")}
									description={ctx.i18next.t(
										"page.monitorsImport.form.sections.schedule.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											{/* The same control, bounds and default the single-monitor form offers,
											applied to every line at once: a pasted list carries no per-site cadence,
											and asking for thirty of them one at a time is the tedium this page
											exists to remove. */}
											<RangeSlider
												label={ctx.i18next.t("page.monitorsImport.form.fields.interval.label")}
												description={ctx.i18next.t(
													"page.monitorsImport.form.fields.interval.description",
												)}
												name="interval_seconds"
												min={IMPORT_INTERVAL.min}
												max={IMPORT_INTERVAL.max}
												step={60}
												scale={60}
												unit="m"
												defaultValue={IMPORT_INTERVAL.default}
												rangeLabels={["1m", "60m"]}
											/>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<Button type="submit">{ctx.i18next.t("page.monitorsImport.form.cta")}</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
