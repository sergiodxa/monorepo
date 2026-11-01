/**
 * The edit flow monitor page, drawn by the edit route and again by the update action when it
 * refuses a submission, so a rejected form comes back holding everything that was typed with
 * an issue beside each field to fix. Deleting sits last, behind a confirmation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, Form, LinkButton } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { SelectFlowMonitor } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import FlowMonitorFormFields from "~/resources/views/flow-monitors/form";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-flow-monitor";

export namespace EditFlowMonitorPage {
	export interface Props {
		monitor: SelectFlowMonitor;
		/** Whether the viewer may delete flow monitors, which decides whether the danger zone renders. */
		canDelete: boolean;
		/** The team's verified hostnames, which the form states as what a spec may reach. */
		verifiedDomains: readonly string[];
		/** The submission the update action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function EditFlowMonitorPage(handle: Handle<EditFlowMonitorPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { monitor, canDelete, verifiedDomains, submission } = handle.props;

		let listHref = routes.app.team.flowMonitors.index.href({ team: ctx.team.slug });
		let showHref = routes.app.team.flowMonitors.show.href({
			team: ctx.team.slug,
			monitorId: monitor.id,
		});
		let values = {
			name: monitor.name,
			source: monitor.source,
			interval_seconds: monitor.interval_seconds,
			is_enabled: monitor.is_enabled,
		};

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.editMonitor.header.named", { name: monitor.name })}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.flowMonitors.edit.href({
						team: ctx.team.slug,
						monitorId: monitor.id,
					})}
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
								issues={submission?.issues}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

								<SettingsSection
									id="settings"
									title={ctx.intl.t("page.editFlowMonitor.form.sections.settings.title")}
									description={ctx.intl.t(
										"page.editFlowMonitor.form.sections.settings.description",
									)}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<FlowMonitorFormFields
												values={values}
												submission={submission}
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
			</DocumentLayout>
		);
	};
}
