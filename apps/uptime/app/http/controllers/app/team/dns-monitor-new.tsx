/**
 * New DNS monitor form page controller. Posts to the `create-dns-monitor` action
 * behind `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import NewDnsMonitorPage from "~/resources/views/dns-monitors/new-page";
import routes from "~/routes/web";

/** GET /app/:team/dns/new — the new DNS monitor form, empty on a first visit. */
export default createAction(routes.app.team.dnsMonitors.new, {
	middleware: [requireUser, requireTeam],
	handler: (ctx) => ctx.render(<NewDnsMonitorPage />),
});
