/**
 * `GET /app/:team/import-monitors` — paste a list of URLs, get one monitor per line. A
 * roster of client sites otherwise means repeating the single-monitor form once per
 * site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { Button, TextArea } from "@sdxc/ui";
import { Table } from "@sdxc/ui/app";
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

/** What the import page shows besides its empty form. */
export interface MonitorsImportForm {
	/** The last import's report, carried once through the session. */
	report?: MonitorImportReport;
	toast?: Toast;
	/** A failed submission's values, drawn back into the fields as they were posted. */
	values?: { urls?: string; interval_seconds?: string };
	/** The translated message under each field a failed submission got wrong. */
	errors?: { urls?: string; interval_seconds?: string };
}

/**
 * Renders the import page for the current request. The import action calls it when the
 * submission itself is invalid, so the pasted list comes back as it was instead of emptied.
 *
 * @param form The report, toast or failed submission to show.
 * @param init The response's status and headers, `400` for a failed submission.
 */
export function renderMonitorsImportPage(form: MonitorsImportForm = {}, init?: ResponseInit) {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let { report, toast, values = {}, errors = {} } = form;
	let interval = Number(values.interval_seconds);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={ctx.intl.t("page.monitorsImport.meta.title")}
			locale={ctx.locale}
		>
			<AppShell
				team={ctx.team}
				currentPath={ctx.url.pathname}
				teams={ctx.teams}
				viewer={viewer}
				isAdmin={ctx.membership.role === "admin"}
				intl={ctx.intl}
				toast={toast}
				heading={ctx.intl.t("page.monitorsImport.header.title")}
				breadcrumbs={[
					{
						label: ctx.intl.t("page.httpMonitors.header.title"),
						href: routes.app.team.monitors.index.href({ team: ctx.team.slug }),
					},
				]}
			>
				<FormPage>
					<div mix={[vstack({ gap: 12 })]}>
						{report && (report.rejected.length > 0 || report.overflow > 0) && (
							<SettingsSection
								id="import-report"
								title={ctx.intl.t("page.monitorsImport.report.section.title")}
								description={ctx.intl.t("page.monitorsImport.report.title", {
									count: report.created,
								})}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<div mix={[vstack({ gap: "12px" })]}>
											{report.rejected.length > 0 && (
												<Table.Container>
													<Table aria-label={ctx.intl.t("page.monitorsImport.report.table.label")}>
														<Table.Header>
															<Table.Row>
																<Table.Column>
																	{ctx.intl.t("page.monitorsImport.report.table.columns.line")}
																</Table.Column>
																<Table.Column>
																	{ctx.intl.t("page.monitorsImport.report.table.columns.input")}
																</Table.Column>
																<Table.Column>
																	{ctx.intl.t("page.monitorsImport.report.table.columns.reason")}
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
																		{ctx.intl.t(
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
													{ctx.intl.t("page.monitorsImport.report.overflow", {
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
								title={ctx.intl.t("page.monitorsImport.form.sections.urls.title")}
								description={ctx.intl.t("page.monitorsImport.form.sections.urls.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<Field
											label={ctx.intl.t("page.monitorsImport.form.fields.urls.label")}
											description={ctx.intl.t("page.monitorsImport.form.fields.urls.description", {
												limit: MAX_IMPORT_LINES,
											})}
											error={errors.urls}
											errorId="import-urls-error"
										>
											<TextArea
												name="urls"
												required
												defaultValue={values.urls}
												aria-invalid={errors.urls ? "true" : undefined}
												aria-describedby={errors.urls ? "import-urls-error" : undefined}
												spellcheck={false}
												placeholder={ctx.intl.t("page.monitorsImport.form.fields.urls.placeholder")}
											/>
										</Field>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="schedule"
								title={ctx.intl.t("page.monitorsImport.form.sections.schedule.title")}
								description={ctx.intl.t("page.monitorsImport.form.sections.schedule.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<RangeSlider
											label={ctx.intl.t("page.monitorsImport.form.fields.interval.label")}
											description={ctx.intl.t(
												"page.monitorsImport.form.fields.interval.description",
											)}
											name="interval_seconds"
											min={IMPORT_INTERVAL.min}
											max={IMPORT_INTERVAL.max}
											step={60}
											scale={60}
											unit="m"
											defaultValue={
												Number.isFinite(interval) && interval > 0
													? interval
													: IMPORT_INTERVAL.default
											}
											rangeLabels={["1m", "60m"]}
										/>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.intl.t("page.monitorsImport.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</div>
				</FormPage>
			</AppShell>
		</DocumentLayout>,
		init,
	);
}

/**
 * GET /app/:team/import-monitors — the bulk URL paste form, plus the last import's
 * report. The interval control mirrors the single-monitor form's bounds and default,
 * applied once to every pasted line since a paste carries no per-site cadence.
 */
export default createAction(routes.app.team.monitorsImport, {
	middleware: [requireUser, requireTeam],
	handler: (ctx) => {
		let session = ctx.get(Session);
		return renderMonitorsImportPage({
			toast: session?.get("toast") as Toast | undefined,
			report: session?.get(MONITOR_IMPORT_REPORT) as MonitorImportReport | undefined,
		});
	},
});
