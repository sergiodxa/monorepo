/**
 * New HTTP monitor form page controller. Posts to the `create-monitor` action.
 * Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MonitorFormFields from "~/resources/views/monitors/form";
import routes from "~/routes/web";

/** GET /app/:team/monitors/new — the new monitor form. */
export default createAction(routes.app.team.monitors.new, {
	middleware: [requireUser, requireTeam],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.createMonitor.header.title")}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.http.create.href({ team: ctx.team.slug })}
						>
							<MonitorFormFields i18next={ctx.i18next} page="createMonitor" />
							<Button type="submit">{ctx.i18next.t("page.createMonitor.form.cta")}</Button>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
