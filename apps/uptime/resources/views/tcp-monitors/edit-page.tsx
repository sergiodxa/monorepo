/**
 * The edit TCP monitor page, drawn by the edit route and again by the update action when it
 * refuses a submission, so a rejected form comes back holding everything that was typed with
 * a message on each field to fix. Deleting sits last, in its own danger zone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { Alert, Button, LinkButton } from "@sdxc/ui";
import { DangerZone } from "@sdxc/ui/app";
import { getContext } from "remix/middleware/async-context";

import type { SelectTcpMonitor } from "~/database/schema";
import type { TcpMonitorSubmission } from "~/resources/views/tcp-monitors/form";

import { getViewer } from "~/app/http/middleware/auth";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

export namespace EditTcpMonitorPage {
	export interface Props {
		monitor: SelectTcpMonitor;
		/** Whether the viewer may delete monitors, which decides whether the danger zone renders. */
		canDelete: boolean;
		/** The submission the update action refused; omitted on a first visit. */
		submission?: TcpMonitorSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function EditTcpMonitorPage(handle: Handle<EditTcpMonitorPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { monitor, canDelete, submission } = handle.props;
		let monitorParams = { team: ctx.team.slug, monitorId: monitor.id };
		let showHref = routes.app.team.tcpMonitors.show.href(monitorParams);

		return (
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · Edit ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.tcpMonitors.edit.href(monitorParams)}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.editTcpMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.intl.t("page.editTcpMonitor.header.breadcrumb.tcpMonitors"),
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
						{ label: monitor.name, href: showHref },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.monitor.tcp.update.href({ team: ctx.team.slug })}
								mix={[vstack({ gap: 6 })]}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />

								{submission && (
									<Alert id="tcp-monitor-form-issues" color="danger">
										<Alert.Content>
											<Alert.Description>
												{ctx.intl.t("page.tcpMonitors.form.issues.summary")}
											</Alert.Description>
										</Alert.Content>
									</Alert>
								)}

								<SettingsSection
									id="settings"
									title={ctx.intl.t("page.editTcpMonitor.form.sections.settings.title")}
									description={ctx.intl.t("page.editTcpMonitor.form.sections.settings.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<TcpMonitorFormFields
												monitor={monitor}
												submission={submission}
												intl={ctx.intl}
												page="editTcpMonitor"
											/>
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton variant="outline" href={showHref}>
												{ctx.intl.t("page.editTcpMonitor.form.cancel")}
											</LinkButton>
											<Button type="submit">{ctx.intl.t("page.editTcpMonitor.form.cta")}</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							{canDelete && (
								<DangerZone
									id="danger"
									title={ctx.intl.t("page.editTcpMonitor.danger.title")}
									description={ctx.intl.t("page.editTcpMonitor.danger.sectionDescription")}
								>
									<DangerZone.Action
										id="delete-tcp-monitor"
										title={ctx.intl.t("page.editTcpMonitor.danger.cta")}
										description={ctx.intl.t("page.editTcpMonitor.danger.warning")}
										buttonLabel={ctx.intl.t("page.editTcpMonitor.danger.cta")}
										confirm={{
											title: ctx.intl.t("page.tcpMonitors.table.actions.confirmation.delete", {
												name: monitor.name,
											}),
											description: ctx.intl.t("page.editTcpMonitor.danger.description"),
											confirmLabel: ctx.intl.t("page.tcpMonitors.table.actions.delete"),
											cancelLabel: ctx.intl.t("page.editTcpMonitor.form.cancel"),
											form: {
												action: routes.actions.monitor.tcp.delete.href({ team: ctx.team.slug }),
												method: "post",
												fields: (
													<>
														<input type="hidden" name="_method" value="DELETE" />
														<input type="hidden" name="monitor_id" value={monitor.id} />
													</>
												),
											},
										}}
									/>
								</DangerZone>
							)}
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
