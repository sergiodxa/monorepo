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
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { m } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { AlertDialog, Button, LinkButton } from "@pkg/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import FlowMonitor from "~/app/data/flow-monitor";
import TeamDomain from "~/app/data/team-domain";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import FlowMonitorFormFields from "~/resources/views/flow-monitors/form";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-flow-monitor";

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

		let verifiedDomains = await TeamDomain.verifiedHostnamesForTeam(db, ctx.team.id);
		let listHref = routes.app.team.flowMonitors.index.href({ team: ctx.team.slug });
		let showHref = routes.app.team.flowMonitors.show.href({
			team: ctx.team.slug,
			monitorId: monitor.id,
		});

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
						{ label: monitor.name, href: showHref },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
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
											<LinkButton variant="outline" href={showHref}>
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
