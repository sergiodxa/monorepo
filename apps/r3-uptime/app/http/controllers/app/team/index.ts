/**
 * `/app/:team` entry redirect. Sends a member straight to the team's dashboard.
 * Requires `requireTeam`, so `ctx.team` is always present here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { createAction } from "remix/fetch-router";

import routes from "~/routes/web";

/** GET /app/:team — redirects to the team's dashboard. */
export default createAction(routes.app.team.index, (ctx) => {
	return redirect(routes.app.team.dashboard.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
