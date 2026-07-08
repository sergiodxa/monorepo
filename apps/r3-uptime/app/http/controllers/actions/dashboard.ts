/**
 * Form action persisting the dashboard's selected monitor-type tab, so the choice
 * survives across visits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import { dashboardTab } from "~/app/http/cookies";
import routes from "~/routes/web";

const DASHBOARD_TABS = ["http", "dns", "tcp", "cron-jobs"] as const;

const SetDashboardTabSchema = f.object({ tab: f.field(s.enum_(DASHBOARD_TABS)) });

/** POST /actions/:team/set-dashboard-tab */
export async function setDashboardTab(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, SetDashboardTabSchema);

	let headers = new Headers();
	if (!isFailure(result)) {
		headers.set("Set-Cookie", await dashboardTab.serialize(result.data.tab));
	}

	return redirect(routes.app.team.dashboard.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
		headers,
	});
}
