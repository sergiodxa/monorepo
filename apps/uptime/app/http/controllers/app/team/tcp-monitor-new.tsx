/**
 * New TCP monitor form page controller. Posts to the `create-tcp-monitor` action.
 * Requires `requireUser` + `requireTeam`.
 *
 * The fields sit in a titled, bordered card with the submit control at its foot,
 * matching the geometry of the other create forms and the settings pages. They
 * stay in a single card because the field markup comes from a view shared with
 * the edit page, which renders it as one block.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

/** GET /app/:team/tcp/new — the new TCP monitor form. */
export default createAction(routes.app.team.tcpMonitors.new, {
	middleware: [requireUser, requireTeam],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New TCP monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.createTcpMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.i18next.t("page.createTcpMonitor.header.breadcrumb.tcpMonitors"),
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.tcp.create.href({ team: ctx.team.slug })}
						>
							<SettingsSection
								id="basics"
								title={ctx.i18next.t("page.createTcpMonitor.form.sections.basics.title")}
								description={ctx.i18next.t(
									"page.createTcpMonitor.form.sections.basics.description",
								)}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TcpMonitorFormFields i18next={ctx.i18next} page="createTcpMonitor" />
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.i18next.t("page.createTcpMonitor.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
