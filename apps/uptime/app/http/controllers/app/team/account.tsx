/**
 * Account page controller. Requires `requireUser` + `requireTeam`. The URL's `:team`
 * selects which shell wraps the page; the settings inside apply to the viewer across
 * every team they belong to, laid out as a settings area with in-page sections.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { AccountToast } from "~/resources/views/account/account-page";

import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { loadAccountOverview } from "~/app/services/account-overview";
import AccountPage from "~/resources/views/account/account-page";
import routes from "~/routes/web";

/** GET /app/:team/account — the signed-in user's account settings. */
export default createAction(routes.app.team.account, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let overview = await loadAccountOverview(ctx.models, viewer.id);
		let toast = ctx.get(Session)?.get("toast") as AccountToast | undefined;
		return ctx.render(<AccountPage overview={overview} toast={toast} />);
	},
});
