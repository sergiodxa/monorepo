/**
 * Form action persisting the dashboard's selected monitor-type tab, so the choice
 * survives across visits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { dashboardTab } from "~/app/http/cookies";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

const DASHBOARD_TABS = ["http", "dns", "tcp", "cron-jobs"] as const;

const SetDashboardTabSchema = f.object({ tab: f.field(s.enum_(DASHBOARD_TABS)) });

/**
 * POST /actions/:team/set-dashboard-tab. Bakes in its own `requireUser`/`requireTeam`
 * chain because it is the only leaf directly under `routes.actions`; every other
 * leaf sits under a resource group with its own `createController()` call.
 * @see routes/web.ts
 */
export const setDashboardTab = createAction(routes.actions.setDashboardTab, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let result = await validate(ctx.formData, SetDashboardTabSchema);

		let headers = new Headers();
		if (!isFailure(result)) {
			headers.set("Set-Cookie", await dashboardTab.serialize(result.data.tab));
		}

		return redirect(routes.app.team.dashboard.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
			headers,
		});
	},
});
