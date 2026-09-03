/**
 * Edit maintenance window page controller. Requires `requireUser` + `requireTeam`;
 * 404s when the window doesn't belong to the current team. Coverage, schedule,
 * behavior, and recurrence fields sit in bordered cards inside one update `<form>`;
 * ending a window early lives in its own neutral card, since it preserves the
 * window's record and history for later review.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { inject } from "@sdxc/service-container";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, Input, Label, LinkButton, Switch, TextField } from "@sdxc/ui";
import { fieldStackLayout } from "@sdxc/ui/styles";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import MaintenanceWindow from "~/app/data/maintenance-window";
import { listScopeMonitors } from "~/app/data/scope-monitors";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { storedMonitorScope } from "~/app/lib/monitor-scope";
import FormPage from "~/resources/components/form-page";
import MonitorScopeField from "~/resources/components/monitor-scope-field";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** `id` shared by the delete-confirmation trigger and its {@link AlertDialog}. */
const DELETE_DIALOG_ID = "delete-maintenance-window";

/** Formats an epoch-ms timestamp for a `datetime-local` input's default value. */
function toDatetimeLocal(epochMs: number): string {
	let date = new Date(epochMs);
	let pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** GET /app/:team/maintenance/:windowId/edit — a maintenance window's edit form. */
export default createAction(routes.app.team.maintenanceWindows.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { windowId } = s.parse(s.object({ windowId: s.string() }), ctx.params);
		let window = await MaintenanceWindow.findByIdForTeam(db, ctx.team.id, windowId);
		if (!window) return notFound("Not Found");

		let scopeGroups = await listScopeMonitors(db, ctx.team.id);
		let isActive =
			window.ended_early_at === null && MaintenanceWindow.isActiveAt(window, Date.now());
		let heading = ctx.i18next.t("page.editMaintenance.header.title", { name: window.name });
		let indexHref = routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug });
		let fields = ctx.i18next.getFixedT(null, "translation", "page.maintenanceWindows.form.fields");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${heading}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={heading}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.maintenance"),
							href: indexHref,
						},
						{ label: window.name },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.maintenanceWindow.update.href({ team: ctx.team.slug })}
								mix={[vstack({ gap: 12 })]}
							>
								<input type="hidden" name="window_id" value={window.id} />

								<SettingsSection
									id="coverage"
									title={ctx.i18next.t("page.editMaintenance.form.sections.coverage.title")}
									description={ctx.i18next.t(
										"page.editMaintenance.form.sections.coverage.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<TextField
												label={fields("name.label")}
												type="text"
												name="name"
												required
												defaultValue={window.name}
											/>

											<MonitorScopeField
												groups={scopeGroups}
												selected={storedMonitorScope(window)}
												description={fields("scope.description")}
												i18next={ctx.i18next}
											/>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="schedule"
									title={ctx.i18next.t("page.editMaintenance.form.sections.schedule.title")}
									description={ctx.i18next.t(
										"page.editMaintenance.form.sections.schedule.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<div mix={[fieldStackLayout()]}>
												<Label htmlFor="maintenance-window-starts-at">
													{fields("startsAt.label")}
												</Label>
												<Input
													id="maintenance-window-starts-at"
													type="datetime-local"
													name="starts_at"
													required
													defaultValue={toDatetimeLocal(window.starts_at)}
												/>
											</div>

											<div mix={[fieldStackLayout()]}>
												<Label htmlFor="maintenance-window-ends-at">{fields("endsAt.label")}</Label>
												<Input
													id="maintenance-window-ends-at"
													type="datetime-local"
													name="ends_at"
													required
													defaultValue={toDatetimeLocal(window.ends_at)}
												/>
											</div>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="behavior"
									title={ctx.i18next.t("page.editMaintenance.form.sections.behavior.title")}
									description={ctx.i18next.t(
										"page.editMaintenance.form.sections.behavior.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<div mix={[vstack({ gap: SETTINGS_SWITCH_GAP })]}>
												<Switch
													name="suppress_alerts"
													value="true"
													defaultChecked={window.suppress_alerts ?? true}
												>
													{fields("suppressAlerts.label")}
												</Switch>

												<Switch
													name="show_on_status_page"
													value="true"
													defaultChecked={window.show_on_status_page ?? true}
												>
													{fields("showOnStatusPage.label")}
												</Switch>
											</div>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="recurrence"
									title={ctx.i18next.t("page.editMaintenance.form.sections.recurrence.title")}
									description={ctx.i18next.t(
										"page.editMaintenance.form.sections.recurrence.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<Switch
												name="is_recurring"
												value="true"
												defaultChecked={window.is_recurring ?? false}
											>
												{fields("recurring.label")}
											</Switch>

											<TextField
												label={fields("recurringPattern.label")}
												name="recurring_pattern"
												defaultValue={window.recurring_pattern ?? ""}
												placeholder={fields("recurringPattern.placeholder")}
												description={fields("recurringPattern.description")}
											/>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton variant="outline" href={indexHref}>
												{ctx.i18next.t("page.editMaintenance.form.cancel")}
											</LinkButton>
											<Button type="submit">
												{ctx.i18next.t("page.editMaintenance.form.cta")}
											</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							{isActive && (
								<SettingsSection
									id="end-now"
									title={ctx.i18next.t("page.editMaintenance.endNow.title")}
									description={ctx.i18next.t("page.editMaintenance.endNow.description")}
								>
									<SettingsSection.Card>
										<form
											method="post"
											action={routes.actions.maintenanceWindow.end.href({ team: ctx.team.slug })}
										>
											<input type="hidden" name="window_id" value={window.id} />
											<SettingsSection.Body>
												<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
													{ctx.i18next.t("page.editMaintenance.endNow.warning")}
												</p>
											</SettingsSection.Body>
											<SettingsSection.Footer>
												<Button type="submit" variant="outline">
													{ctx.i18next.t("page.editMaintenance.endNow.cta")}
												</Button>
											</SettingsSection.Footer>
										</form>
									</SettingsSection.Card>
								</SettingsSection>
							)}

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.i18next.t("page.editMaintenance.danger.title")}
								description={ctx.i18next.t("page.editMaintenance.danger.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.i18next.t("page.editMaintenance.danger.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_DIALOG_ID}
											command="show-modal"
										>
											{ctx.i18next.t("page.editMaintenance.danger.delete.trigger")}
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
										{ctx.i18next.t("page.editMaintenance.danger.delete.confirmTitle")}
									</AlertDialog.Title>
									<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
										{ctx.i18next.t("page.editMaintenance.danger.delete.confirmDescription")}
									</AlertDialog.Description>
								</AlertDialog.Header>
								<form
									method="post"
									action={routes.actions.maintenanceWindow.delete.href({ team: ctx.team.slug })}
								>
									<input type="hidden" name="_method" value="DELETE" />
									<input type="hidden" name="window_id" value={window.id} />
									<AlertDialog.Footer>
										<AlertDialog.Cancel commandfor={DELETE_DIALOG_ID}>
											{ctx.i18next.t("page.editMaintenance.form.cancel")}
										</AlertDialog.Cancel>
										<AlertDialog.Action commandfor={DELETE_DIALOG_ID} type="submit">
											{ctx.i18next.t("page.editMaintenance.danger.delete.confirm")}
										</AlertDialog.Action>
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
