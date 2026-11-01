/**
 * New HTTP monitor form page controller. Posts to the `create-monitor` action, which draws the
 * same page again with the submitted values and per-field issues when they fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { MONITOR_URL_PREFILL } from "~/app/http/validators/monitor";
import NewMonitorPage from "~/resources/views/monitors/new-page";
import routes from "~/routes/web";

/**
 * Longest pre-fill accepted from `?url=`. JSX already escapes the echoed
 * value; this only limits how much of somebody else's query string the page
 * renders back to them.
 */
const MAX_PREFILL_LENGTH = 2048;

/** GET /app/:team/monitors/new — the new monitor form, its URL pre-filled from `?url=`. */
export default createAction(routes.app.team.monitors.new, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: (ctx) => {
		let prefill = ctx.url.searchParams.get(MONITOR_URL_PREFILL)?.slice(0, MAX_PREFILL_LENGTH);
		return ctx.render(<NewMonitorPage defaultUrl={prefill} />);
	},
});
