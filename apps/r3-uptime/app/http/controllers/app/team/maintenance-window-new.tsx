/**
 * New maintenance window page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MaintenanceWindowFormFields from "~/resources/views/maintenance-windows/form";
import routes from "~/routes/web";

/** GET /app/:team/maintenance/new — the new maintenance-window form. */
export default createAction(routes.app.team.maintenanceWindows.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.i18next.t("page.createMaintenance.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.createMaintenance.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.maintenance"),
							href: routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<div>
						<form
							method="post"
							action={routes.actions.maintenanceWindow.create.href({ team: ctx.team.slug })}
						>
							<MaintenanceWindowFormFields monitors={monitors} />
							<Button type="submit">{ctx.i18next.t("page.createMaintenance.form.cta")}</Button>
						</form>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
