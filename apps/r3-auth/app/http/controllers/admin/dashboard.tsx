/**
 * GET /admin — the admin landing page: how many clients are registered, how many
 * subjects exist, and how many sessions have not expired. The three counts are read in
 * parallel because none of them depends on another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import subjectAccess, { requireAdminArea } from "~/app/http/middleware/access";
import requireSubject from "~/app/http/middleware/require-subject";
import { toChrome } from "~/app/http/view-models/admin";
import DashboardView from "~/resources/views/admin/dashboard";
import routes from "~/routes/web";

export default createAction(routes.admin.dashboard, {
	middleware: [requireSubject, subjectAccess, requireAdminArea],
	/**
	 * Renders the three aggregate counts that describe the server's size and liveness.
	 * The dashboard is the root of the admin area, so its breadcrumb trail is empty and
	 * the heading stands alone.
	 */
	handler: async (ctx) => {
		let [clients, subjects, activeSessions] = await Promise.all([
			ctx.models.clients.query().count(),
			ctx.models.subjects.query().count(),
			ctx.models.sessions.active().count(),
		]);

		let chrome = toChrome(ctx, {
			documentTitle: ctx.intl.t("admin.dashboard.documentTitle"),
			heading: ctx.intl.t("admin.dashboard.title"),
			section: "dashboard",
			breadcrumbs: [],
		});

		return ctx.render(
			<DashboardView
				chrome={chrome}
				stats={{
					clients: {
						label: ctx.intl.t("admin.dashboard.stats.clients.label"),
						value: clients,
						description: ctx.intl.t("admin.dashboard.stats.clients.description"),
					},
					subjects: {
						label: ctx.intl.t("admin.dashboard.stats.subjects.label"),
						value: subjects,
						description: ctx.intl.t("admin.dashboard.stats.subjects.description"),
					},
					sessions: {
						label: ctx.intl.t("admin.dashboard.stats.sessions.label"),
						value: activeSessions,
						description: ctx.intl.t("admin.dashboard.stats.sessions.description"),
					},
				}}
			/>,
		);
	},
});
