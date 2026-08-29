/**
 * New flow monitor form page controller. Posts to the `create-flow-monitor` action. Requires
 * `requireUser` + `requireTeam`.
 *
 * Reads the team's verified domains so the form can state what a spec written here may
 * reach. The action enforces that same restriction, so surfacing it here lets a writer
 * target a domain that will actually be accepted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { Button } from "@pkg/ui";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

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

/** GET /app/:team/flows/new — the new flow monitor form. */
export default createAction(routes.app.team.flowMonitors.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let verifiedDomains = await TeamDomain.verifiedHostnamesForTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New flow monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.createFlowMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.i18next.t("page.createFlowMonitor.header.breadcrumb.flowMonitors"),
							href: routes.app.team.flowMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.flow.create.href({ team: ctx.team.slug })}
						>
							<SettingsSection
								id="basics"
								title={ctx.i18next.t("page.createFlowMonitor.form.sections.basics.title")}
								description={ctx.i18next.t(
									"page.createFlowMonitor.form.sections.basics.description",
								)}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<FlowMonitorFormFields
											verifiedDomains={verifiedDomains}
											i18next={ctx.i18next}
											page="createFlowMonitor"
										/>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">
											{ctx.i18next.t("page.createFlowMonitor.form.cta")}
										</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
