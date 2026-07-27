/**
 * New status page page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import StatusPageFormFields from "~/resources/views/status-pages/form";
import routes from "~/routes/web";

/** GET /app/:team/status-pages/new — the new status-page form. */
export default createAction(routes.app.team.statusPages.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [monitors, dnsMonitors, tcpMonitors, cronJobs] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			DnsMonitor.listByTeam(db, ctx.team.id),
			TcpMonitor.listByTeam(db, ctx.team.id),
			CronJobMonitor.listByTeam(db, ctx.team.id),
		]);

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.i18next.t("page.createStatusPage.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.createStatusPage.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.statusPages"),
							href: routes.app.team.statusPages.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.statusPage.create.href({ team: ctx.team.slug })}
						>
							<StatusPageFormFields
								monitors={monitors}
								dnsMonitors={dnsMonitors}
								tcpMonitors={tcpMonitors}
								cronJobs={cronJobs}
								i18next={ctx.i18next}
							/>
							<Button type="submit">{ctx.i18next.t("page.statusPages.form.cta")}</Button>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
