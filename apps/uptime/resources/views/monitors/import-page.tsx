/**
 * The bulk monitor import page: paste a list of URLs, get one monitor per line. Drawn by the
 * GET route, with the last import's report, and again by the import action when it refuses a
 * submission, so the pasted list comes back as it was instead of emptied.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { Button, TextArea } from "@sdxc/ui";
import { Table } from "@sdxc/ui/app";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { MonitorImportReport } from "~/app/http/validators/monitor-import";

import { getViewer } from "~/app/http/middleware/auth";
import { fieldIssue, submittedText } from "~/app/http/validators/form-submission";
import { IMPORT_INTERVAL, MAX_IMPORT_LINES } from "~/app/http/validators/monitor-import";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import { RangeSlider } from "~/resources/components/range-slider";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** A one-render flash message the redirect-after-post pattern leaves behind. */
export interface MonitorsImportToast {
	intent: "success" | "error";
	message: string;
}

export namespace MonitorsImportPage {
	export interface Props {
		/** The last import's report, carried once through the session. */
		report?: MonitorImportReport;
		/** The flash the redirect-after-post pattern leaves behind for one render. */
		toast?: MonitorsImportToast;
		/** The submission the import action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function MonitorsImportPage(handle: Handle<MonitorsImportPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { report, toast, submission } = handle.props;

		let interval = Number(submittedText(submission, "interval_seconds", ""));
		let urlsIssue = fieldIssue(submission, "urls");

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={ctx.intl.t("page.monitorsImport.meta.title")}
				locale={ctx.locale}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.monitorsImport.href({ team: ctx.team.slug })}
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
														<Table
															aria-label={ctx.intl.t("page.monitorsImport.report.table.label")}
														>
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
												description={ctx.intl.t(
													"page.monitorsImport.form.fields.urls.description",
													{
														limit: MAX_IMPORT_LINES,
													},
												)}
												error={urlsIssue}
												errorId="import-urls-error"
											>
												<TextArea
													name="urls"
													required
													defaultValue={submittedText(submission, "urls", "")}
													aria-invalid={urlsIssue ? "true" : undefined}
													aria-describedby={urlsIssue ? "import-urls-error" : undefined}
													spellcheck={false}
													placeholder={ctx.intl.t(
														"page.monitorsImport.form.fields.urls.placeholder",
													)}
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
			</DocumentLayout>
		);
	};
}
