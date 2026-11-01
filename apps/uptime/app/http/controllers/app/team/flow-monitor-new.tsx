/**
 * New flow monitor form page controller. Posts to the `create-flow-monitor` action, which
 * renders this page again with what was typed when it refuses a submit. Requires `requireUser`
 * + `requireTeam`, and reads the team's verified domains so the form states what a spec may reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Form } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { FlowMonitorFormState } from "~/resources/views/flow-monitors/form";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import FlowMonitorFormFields, {
	NEW_FLOW_MONITOR_VALUES,
} from "~/resources/views/flow-monitors/form";
import routes from "~/routes/web";

/**
 * Renders the new flow monitor page for the current request, empty or holding a rejected
 * submit. A rejected submit answers 400, keeping what was typed in every field.
 *
 * @param state - What was submitted and why it was refused; omitted for a fresh form.
 */
export async function renderNewFlowMonitorPage(state?: FlowMonitorFormState): Promise<Response> {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.team.id);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${ctx.team.name} · ${ctx.intl.t("page.createFlowMonitor.header.title")}`}
		>
			<AppShell
				team={ctx.team}
				currentPath={ctx.url.pathname}
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
						issues={state?.issues}
					>
						<SettingsSection
							id="basics"
							title={ctx.intl.t("page.createFlowMonitor.form.sections.basics.title")}
							description={ctx.intl.t("page.createFlowMonitor.form.sections.basics.description")}
						>
							<SettingsSection.Card>
								<SettingsSection.Body>
									<FlowMonitorFormFields
										values={state?.values ?? NEW_FLOW_MONITOR_VALUES}
										issues={state?.issues}
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
		</DocumentLayout>,
		{ status: state === undefined ? 200 : 400 },
	);
}

/** GET /app/:team/flows/new — the new flow monitor form. */
export default createAction(routes.app.team.flowMonitors.new, {
	middleware: [requireUser, requireTeam],
	handler: () => renderNewFlowMonitorPage(),
});
