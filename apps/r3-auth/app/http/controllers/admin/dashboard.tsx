/**
 * GET /admin — the admin landing page: how many clients are registered, how many
 * subjects exist, and how many sessions have not expired. The three counts are read in
 * parallel because none of them depends on another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Client from "~/app/data/client";
import Session from "~/app/data/session";
import Subject from "~/app/data/subject";
import requireAdmin from "~/app/http/middleware/require-admin";
import { toChrome } from "~/app/http/view-models/admin";
import DashboardView from "~/resources/views/admin/dashboard";
import routes from "~/routes/web";

export default createAction(routes.admin.dashboard, {
	middleware: [requireAdmin],
	/**
	 * Renders the three aggregate counts that describe the server's size and liveness.
	 * The dashboard is the root of the admin area, so its breadcrumb trail is empty and
	 * the heading stands alone.
	 */
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();

		let [clients, subjects, activeSessions] = await Promise.all([
			Client.count(db),
			Subject.count(db),
			Session.countActive(db),
		]);

		let chrome = toChrome(ctx, {
			documentTitle: ctx.i18next.t("admin.dashboard.documentTitle"),
			heading: ctx.i18next.t("admin.dashboard.title"),
			section: "dashboard",
			breadcrumbs: [],
		});

		return ctx.render(
			<DashboardView
				chrome={chrome}
				stats={{
					clients: {
						label: ctx.i18next.t("admin.dashboard.stats.clients.label"),
						value: clients,
						description: ctx.i18next.t("admin.dashboard.stats.clients.description"),
					},
					subjects: {
						label: ctx.i18next.t("admin.dashboard.stats.subjects.label"),
						value: subjects,
						description: ctx.i18next.t("admin.dashboard.stats.subjects.description"),
					},
					sessions: {
						label: ctx.i18next.t("admin.dashboard.stats.sessions.label"),
						value: activeSessions,
						description: ctx.i18next.t("admin.dashboard.stats.sessions.description"),
					},
				}}
			/>,
		);
	}),
});
