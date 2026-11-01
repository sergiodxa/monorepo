/**
 * New TCP monitor form page controller. Posts to the `create-tcp-monitor` action.
 * Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import NewTcpMonitorPage from "~/resources/views/tcp-monitors/new-page";
import routes from "~/routes/web";

/** GET /app/:team/tcp/new — the new TCP monitor form, empty on a first visit. */
export default createAction(routes.app.team.tcpMonitors.new, {
	middleware: [requireUser, requireTeam],
	handler: (ctx) => ctx.render(<NewTcpMonitorPage />),
});
