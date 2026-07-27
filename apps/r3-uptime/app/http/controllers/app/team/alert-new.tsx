/**
 * New alert page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

/** GET /app/:team/alerts/new — the new alert form. */
export default createAction(routes.app.team.alerts.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.i18next.t("page.createAlert.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.createAlert.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.alerts"),
							href: routes.app.team.alerts.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form method="post" action={routes.actions.alert.create.href({ team: ctx.team.slug })}>
							<AlertFormFields monitors={monitors} i18next={ctx.i18next} />
							<Button type="submit">{ctx.i18next.t("page.alerts.form.cta")}</Button>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
