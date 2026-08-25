/**
 * `GET /app/:team/import-monitors` — paste a list of URLs, get one monitor per line.
 *
 * A roster of client sites otherwise means repeating the single-monitor form once per
 * site. It reuses that same creation path, so an imported monitor is indistinguishable
 * from a hand-made one, needing no column mapping or per-vendor field translation.
 *
 * The action redirects back here with a one-time report whenever a line did not become
 * a monitor, so the reasons sit above the box the corrected lines get pasted into. That
 * box stays empty afterward, since resubmitting rejected text risks the wrong URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { Button, Table, TextArea } from "@pkg/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
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

/**
 * GET /app/:team/import-monitors — the bulk URL paste form, plus the last import's
 * report. The interval control mirrors the single-monitor form's bounds and default,
 * applied once to every pasted line since a paste carries no per-site cadence.
 */
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
