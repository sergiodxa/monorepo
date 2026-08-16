/**
 * `/app/:team` entry redirect. Sends a member straight to the team's dashboard.
 * Requires `requireTeam`, so `ctx.team` is always present here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

/** GET /app/:team — redirects to the team's dashboard. */
export default createAction(routes.app.team.index, {
	middleware: [requireUser, requireTeam],
	handler: (ctx) => {
		return redirect(routes.app.team.dashboard.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
});
