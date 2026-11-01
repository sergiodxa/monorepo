/**
 * The new TCP monitor page, drawn by the form's GET route and again by the create action when
 * it refuses a submission, so a rejected form comes back holding everything that was typed
 * with a message on each field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { Alert, Button } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { TcpMonitorSubmission } from "~/resources/views/tcp-monitors/form";

import { getViewer } from "~/app/http/middleware/auth";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

export namespace NewTcpMonitorPage {
	export interface Props {
		/** The submission the create action refused; omitted on a first visit. */
		submission?: TcpMonitorSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function NewTcpMonitorPage(handle: Handle<NewTcpMonitorPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { submission } = handle.props;

		return (
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · New TCP monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.tcpMonitors.new.href({ team: ctx.team.slug })}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.createTcpMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.intl.t("page.createTcpMonitor.header.breadcrumb.tcpMonitors"),
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.tcp.create.href({ team: ctx.team.slug })}
							mix={[vstack({ gap: 6 })]}
						>
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
								id="basics"
								title={ctx.intl.t("page.createTcpMonitor.form.sections.basics.title")}
								description={ctx.intl.t("page.createTcpMonitor.form.sections.basics.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TcpMonitorFormFields
											intl={ctx.intl}
											page="createTcpMonitor"
											submission={submission}
										/>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.intl.t("page.createTcpMonitor.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
