/**
 * The new flow monitor page, drawn by the form's GET route and again by the create action when
 * it refuses a submission, so a rejected form comes back holding everything that was typed
 * with an issue beside each field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Button, Form } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";

import { getViewer } from "~/app/http/middleware/auth";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import FlowMonitorFormFields, {
	NEW_FLOW_MONITOR_VALUES,
} from "~/resources/views/flow-monitors/form";
import routes from "~/routes/web";

export namespace NewFlowMonitorPage {
	export interface Props {
		/** The team's verified hostnames, which the form states as what a spec may reach. */
		verifiedDomains: readonly string[];
		/** The submission the create action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function NewFlowMonitorPage(handle: Handle<NewFlowMonitorPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { verifiedDomains, submission } = handle.props;

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.createFlowMonitor.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.flowMonitors.new.href({ team: ctx.team.slug })}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.createFlowMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.intl.t("page.createFlowMonitor.header.breadcrumb.flowMonitors"),
							href: routes.app.team.flowMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<Form
							method="post"
							action={routes.actions.monitor.flow.create.href({ team: ctx.team.slug })}
							issues={submission?.issues}
						>
							<SettingsSection
								id="basics"
								title={ctx.intl.t("page.createFlowMonitor.form.sections.basics.title")}
								description={ctx.intl.t("page.createFlowMonitor.form.sections.basics.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<FlowMonitorFormFields
											values={NEW_FLOW_MONITOR_VALUES}
											submission={submission}
											verifiedDomains={verifiedDomains}
											intl={ctx.intl}
											page="createFlowMonitor"
										/>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.intl.t("page.createFlowMonitor.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</Form>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
