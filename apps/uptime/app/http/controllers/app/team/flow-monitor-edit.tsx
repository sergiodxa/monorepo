/**
 * Edit flow monitor page controller: the settings form posting to `update-flow-monitor`, which
 * renders this page again with what was typed when it refuses a submit, and a danger-toned card
 * for deletion. Requires `requireUser` + `requireTeam`; 404s on another team's monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, Form, LinkButton } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { SelectFlowMonitor } from "~/database/schema";
import type { FlowMonitorFormState } from "~/resources/views/flow-monitors/form";

import { teamAccess } from "~/app/http/middleware/access";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import FlowMonitorFormFields from "~/resources/views/flow-monitors/form";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-flow-monitor";

/**
 * Renders the edit page for `monitor` in the current request, holding either the stored values
 * or a rejected submit. A rejected submit answers 400, keeping what was typed in every field.
 *
 * @param monitor - The monitor being edited, already scoped to the team.
 * @param state - What was submitted and why it was refused; omitted to show the stored values.
 */
export async function renderEditFlowMonitorPage(
	monitor: SelectFlowMonitor,
	state?: FlowMonitorFormState,
): Promise<Response> {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	await ctx.access.load(abilities.flowMonitors.delete);
	let canDelete = ctx.access.can(abilities.flowMonitors.delete);

	let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.team.id);
	let listHref = routes.app.team.flowMonitors.index.href({ team: ctx.team.slug });
	let showHref = routes.app.team.flowMonitors.show.href({
		team: ctx.team.slug,
		monitorId: monitor.id,
	});
	let values = state?.values ?? {
		name: monitor.name,
		source: monitor.source,
		interval_seconds: monitor.interval_seconds,
		is_enabled: monitor.is_enabled,
	};

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${ctx.team.name} · ${ctx.intl.t("page.editFlowMonitor.header.title")} ${monitor.name}`}
		>
			<AppShell
				team={ctx.team}
				currentPath={ctx.url.pathname}
				teams={ctx.teams}
				viewer={viewer}
				isAdmin={ctx.membership.role === "admin"}
				intl={ctx.intl}
				heading={ctx.intl.t("page.editFlowMonitor.header.title")}
				breadcrumbs={[
					{
						label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
						href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
					},
					{
						label: ctx.intl.t("page.editFlowMonitor.header.breadcrumb.flowMonitors"),
						href: listHref,
					},
					{ label: monitor.name, href: showHref },
				]}
			>
				<FormPage>
					<div mix={[vstack({ gap: 12 })]}>
						<Form
							method="post"
							action={routes.actions.monitor.flow.update.href({ team: ctx.team.slug })}
							issues={state?.issues}
						>
							<input type="hidden" name="monitor_id" value={monitor.id} />

							<SettingsSection
								id="settings"
								title={ctx.intl.t("page.editFlowMonitor.form.sections.settings.title")}
								description={ctx.intl.t("page.editFlowMonitor.form.sections.settings.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<FlowMonitorFormFields
											values={values}
											issues={state?.issues}
											showEnabled
											verifiedDomains={verifiedDomains}
											intl={ctx.intl}
											page="editFlowMonitor"
										/>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<LinkButton variant="outline" href={showHref}>
											{ctx.intl.t("page.editFlowMonitor.form.cancel")}
										</LinkButton>
										<Button type="submit">{ctx.intl.t("page.editFlowMonitor.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</Form>

						{canDelete ? (
							<>
								<SettingsSection
									id="danger"
									tone="danger"
									title={ctx.intl.t("page.editFlowMonitor.danger.title")}
									description={ctx.intl.t("page.editFlowMonitor.danger.sectionDescription")}
								>
									<SettingsSection.Card tone="danger">
										<SettingsSection.Body>
											<p mix={[m(0), fontSize("sm"), fg("danger")]}>
												{ctx.intl.t("page.editFlowMonitor.danger.warning")}
											</p>
										</SettingsSection.Body>
										<SettingsSection.Footer tone="danger">
											<Button
												type="button"
												color="danger"
												commandfor={DELETE_DIALOG_ID}
												command="show-modal"
											>
												{ctx.intl.t("page.editFlowMonitor.danger.cta")}
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
											{ctx.intl.t("page.flowMonitors.table.actions.confirmation.delete", {
												name: monitor.name,
											})}
										</AlertDialog.Title>
										<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
											{ctx.intl.t("page.editFlowMonitor.danger.description")}
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
												{ctx.intl.t("page.editFlowMonitor.form.cancel")}
											</AlertDialog.Cancel>
											<Button type="submit" color="danger">
												{ctx.intl.t("page.flowMonitors.table.actions.delete")}
											</Button>
										</AlertDialog.Footer>
									</form>
								</AlertDialog>
							</>
						) : null}
					</div>
				</FormPage>
			</AppShell>
		</DocumentLayout>,
		{ status: state === undefined ? 200 : 400 },
	);
}

/** GET /app/:team/flows/:monitorId/edit — a flow monitor's edit form. */
export default createAction(routes.app.team.flowMonitors.edit, {
	middleware: [requireUser, requireTeam, teamAccess],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.flowMonitors
			.inTeam(ctx.team.id)
			.where({ id: monitorId })
			.first();
		if (!monitor) return notFound("Not Found");

		return renderEditFlowMonitorPage(monitor);
	},
});
