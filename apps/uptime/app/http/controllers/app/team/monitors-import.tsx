/**
 * `GET /app/:team/import-monitors` — paste a list of URLs, get one monitor per line.
 *
 * The create form is right for one monitor and wrong for thirty. An agency arriving with a
 * roster of client sites has no way to get them in other than repeating the same form once per
 * site, which is the single most tedious thing this product asks of exactly the customer it is
 * trying to win — and it is asked at the worst possible moment, before they have seen any value.
 *
 * Paste-a-list rather than CSV, competitor imports, or sitemap discovery, all of which were
 * considered first: this needs no column mapping, no third-party API, no per-vendor field
 * translation that breaks when a vendor changes theirs, and no new data model. It reuses the
 * same creation path the form uses, so an imported monitor is indistinguishable from a
 * hand-made one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/import-monitors — the bulk URL paste form. */
export default createAction(routes.app.team.monitorsImport, {
	middleware: [requireUser, requireTeam],
	handler: async () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		return ctx.render(
			<DocumentLayout title={ctx.i18next.t("page.monitorsImport.meta.title")} locale={ctx.locale}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.monitorsImport.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("page.httpMonitors.header.title"),
							href: routes.app.team.monitors.index.href({ team: ctx.team.slug }),
						},
						{ label: ctx.i18next.t("page.monitorsImport.header.title") },
					]}
				>
					<h1>{ctx.i18next.t("page.monitorsImport.header.title")}</h1>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
