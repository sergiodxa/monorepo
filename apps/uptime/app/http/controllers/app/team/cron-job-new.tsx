/**
 * New cron-job monitor page controller. Requires `requireUser` + `requireTeam`; the create
 * action draws the same page again with what was typed and the issues when it refuses a
 * submission, so a mistake costs one correction rather than the whole form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import NewCronJobPage from "~/resources/views/cron-jobs/new-page";
import routes from "~/routes/web";

/** GET /app/:team/cron-jobs/new — the new cron-job monitor form, empty on a first visit. */
export default createAction(routes.app.team.cronJobs.new, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: (ctx) => ctx.render(<NewCronJobPage />),
});
