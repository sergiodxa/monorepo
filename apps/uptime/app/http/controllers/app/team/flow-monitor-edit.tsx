/**
 * Edit flow monitor page controller: the settings form posting to `update-flow-monitor`, the
 * last run's outcome, and a danger-toned card for deletion. Requires `requireUser` +
 * `requireTeam`; 404s when the monitor doesn't belong to the current team.
 *
 * The last result is rendered here rather than on a page of its own, and it is the reason this
 * type needs no `show` route: a flow's outcome is the assertion that broke and the line it is
 * written on, which belongs beside the source it refers to. Reading "expected 200, observed 500
 * on line 9" while looking at line 9 is the whole point.
 *
 * The delete confirmation is `@pkg/ui`'s `AlertDialog` composed directly rather than through the
 * `Confirm` wrapper, since the confirming control is a real `<form method="post">` submit button
 * rather than a `command="close"` action — the same composition the other monitor types use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { IntlProvider } from "@pkg/i18n/ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { m } from "@pkg/u/size";
import { font, fontSize, whiteSpace } from "@pkg/u/typography";
import { AlertDialog, Badge, Button, LinkButton } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { BadgeTone } from "~/resources/components/badge";

import FlowMonitor from "~/app/data/flow-monitor";
import TeamDomain from "~/app/data/team-domain";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import FormPage from "~/resources/components/form-page";
import RunFlowButton from "~/resources/components/run-flow-button";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import FlowMonitorFormFields from "~/resources/views/flow-monitors/form";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-flow-monitor";

/** See the list controller: `error` is neutral because it is our failure, not an outage. */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	down: "down",
	error: "neutral",
};

/** GET /app/:team/flows/:monitorId/edit — a flow monitor's edit form. */
export default createAction(routes.app.team.flowMonitors.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await FlowMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let [verifiedDomains, results] = await Promise.all([
			TeamDomain.verifiedHostnamesForTeam(db, ctx.team.id),
			FlowMonitor.listResults(db, monitor.id, 1),
		]);
		let last = results[0];
		let listHref = routes.app.team.flowMonitors.index.href({ team: ctx.team.slug });

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.editFlowMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.i18next.t("page.editFlowMonitor.header.breadcrumb.flowMonitors"),
							href: listHref,
						},
						{ label: monitor.name, href: listHref },
					]}
					actions={
						/*
						 * RunFlowButton is a `clientEntry` island: its render function runs both
						 * server-side (for the no-JS baseline markup) and client-side (after hydration).
						 * Client-side, `intl(handle)` falls back to the module-scoped default
						 * `bootstrap/browser.ts` registers via `setIntl()` — but that default is never set
						 * server-side (a module-scoped instance would leak across concurrent requests in a
						 * Workers isolate), so the SSR pass needs this request-scoped `IntlProvider`
						 * ancestor for `intl(handle)` to resolve at all.
						 */
						<IntlProvider i18n={ctx.i18next}>
							<RunFlowButton
								action={routes.actions.monitor.flow.check.href({ team: ctx.team.slug })}
								monitorId={monitor.id}
								name={monitor.name}
							/>
						</IntlProvider>
					}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							{last !== undefined && (
								<SettingsSection
									id="last-run"
									title={ctx.i18next.t("page.editFlowMonitor.lastRun.title")}
									description={ctx.i18next.t("page.editFlowMonitor.lastRun.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<div mix={[vstack({ gap: 8 })]}>
												<Badge {...badgeVariant(STATUS_BADGE_TONE[last.status] ?? "neutral")}>
													{ctx.i18next.t(`page.flowMonitors.table.status.${last.status}`)}
												</Badge>

												<p mix={[m(0), fontSize("sm"), fg("muted")]}>
													{ctx.i18next.t("page.editFlowMonitor.lastRun.summary", {
														passed: last.tests_passed,
														total: last.tests_total,
														requests: last.requests_made,
														duration: last.duration_ms ?? 0,
													})}
												</p>

												{last.failed_test !== null && (
													<p mix={[m(0), fontSize("sm")]}>
														{ctx.i18next.t("page.editFlowMonitor.lastRun.failedTest", {
															test: last.failed_test,
															line: last.failed_at_line ?? 0,
														})}
													</p>
												)}

												{(last.failure_detail ?? last.error_message) !== null && (
													<pre
														mix={[
															m(0),
															font("mono"),
															fontSize("sm"),
															fg("danger"),
															whiteSpace("pre-wrap"),
														]}
													>
														{last.failure_detail ?? last.error_message}
													</pre>
												)}
											</div>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>
							)}

							<form
								method="post"
								action={routes.actions.monitor.flow.update.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

								<SettingsSection
									id="settings"
									title={ctx.i18next.t("page.editFlowMonitor.form.sections.settings.title")}
									description={ctx.i18next.t(
										"page.editFlowMonitor.form.sections.settings.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<FlowMonitorFormFields
												monitor={monitor}
												verifiedDomains={verifiedDomains}
												i18next={ctx.i18next}
												page="editFlowMonitor"
											/>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton variant="outline" href={listHref}>
												{ctx.i18next.t("page.editFlowMonitor.form.cancel")}
											</LinkButton>
											<Button type="submit">
												{ctx.i18next.t("page.editFlowMonitor.form.cta")}
											</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.i18next.t("page.editFlowMonitor.danger.title")}
								description={ctx.i18next.t("page.editFlowMonitor.danger.sectionDescription")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.i18next.t("page.editFlowMonitor.danger.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_DIALOG_ID}
											command="show-modal"
										>
											{ctx.i18next.t("page.editFlowMonitor.danger.cta")}
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
										{ctx.i18next.t("page.flowMonitors.table.actions.confirmation.delete", {
											name: monitor.name,
										})}
									</AlertDialog.Title>
									<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
										{ctx.i18next.t("page.editFlowMonitor.danger.description")}
									</AlertDialog.Description>
								</AlertDialog.Header>
								<form
									method="post"
									action={routes.actions.monitor.flow.delete.href({ team: ctx.team.slug })}
								>
									<input type="hidden" name="_method" value="DELETE" />
									<input type="hidden" name="monitor_id" value={monitor.id} />
									<AlertDialog.Footer>
										<AlertDialog.Cancel type="button" commandfor={DELETE_DIALOG_ID}>
											{ctx.i18next.t("page.editFlowMonitor.form.cancel")}
										</AlertDialog.Cancel>
										<Button type="submit" color="danger">
											{ctx.i18next.t("page.flowMonitors.table.actions.delete")}
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
