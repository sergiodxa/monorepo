/**
 * `GET /app/:team/import-monitors` — paste a list of URLs, get one monitor per line. A
 * roster of client sites otherwise means repeating the single-monitor form once per
 * site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { MonitorImportReport } from "~/app/http/validators/monitor-import";
import type { MonitorsImportToast } from "~/resources/views/monitors/import-page";

import { MONITOR_IMPORT_REPORT } from "~/app/http/controllers/actions/monitors-import";
import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import MonitorsImportPage from "~/resources/views/monitors/import-page";
import routes from "~/routes/web";

/**
 * GET /app/:team/import-monitors — the bulk URL paste form, plus the last import's
 * report. The interval control mirrors the single-monitor form's bounds and default,
 * applied once to every pasted line since a paste carries no per-site cadence.
 */
export default createAction(routes.app.team.monitorsImport, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: (ctx) => {
		let session = ctx.get(Session);
		return ctx.render(
			<MonitorsImportPage
				toast={session?.get("toast") as MonitorsImportToast | undefined}
				report={session?.get(MONITOR_IMPORT_REPORT) as MonitorImportReport | undefined}
			/>,
		);
	},
});
