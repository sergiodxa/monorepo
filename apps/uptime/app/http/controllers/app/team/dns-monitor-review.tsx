/**
 * DNS monitor review page controller. GET /app/:team/dns/:monitorId/review — the step
 * between creating a domain monitor and monitoring anything with it: discovery has already
 * run and written the monitor's records, and this is where the visitor accepts or declines
 * each one before it becomes an expectation. Requires `requireUser` + `requireTeam`.
 *
 * Registered as a stub so the route is complete and typed ahead of the screen itself. It
 * answers `501 Not Implemented`; rendering an empty review list instead would say discovery
 * found nothing, which is a claim about the visitor's zone rather than about our progress.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notImplemented } from "@pkg/http/response/html";
import { createAction } from "remix/fetch-router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

/** GET /app/:team/dns/:monitorId/review — the discovered-records review screen. */
export default createAction(routes.app.team.dnsMonitors.review, {
	middleware: [requireUser, requireTeam],
	handler: () => notImplemented("Not Implemented"),
});
