/**
 * `POST /actions/:team/import-monitors` — creates one monitor per URL in a pasted list.
 *
 * Every URL goes through the same validation and the same `Monitor.create` the single-monitor
 * form uses, so an imported monitor is indistinguishable from a hand-made one and no second
 * creation path exists to drift from the first.
 *
 * Pasting thirty lines off a spreadsheet routinely produces a stray blank, a duplicate, or
 * something that isn't a URL, so the good lines are created immediately and the bad ones
 * come back with their reasons — one bad line among many still leaves the batch usable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { MonitorImportReport } from "~/app/http/validators/monitor-import";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import { ImportMonitorsSchema, parseMonitorImportList } from "~/app/http/validators/monitor-import";
import routes from "~/routes/web";

/**
 * Session key the import page reads its one-time report from.
 *
 * The session carries the report because it holds the lines somebody pasted, and a session
 * read is private and single-use — matching a report that is meant for exactly one render.
 */
export const MONITOR_IMPORT_REPORT = "monitorImport";

/**
 * Created monitors rely on the every-minute scheduler for their first check: `Monitor.create`
 * stamps `next_due_at` at now, so the scheduler claims all of them on its next tick, keeping
 * this request's cost flat no matter how long the pasted list is.
 */
export const importMonitors = createAction(routes.actions.monitor.http.import, async (ctx) => {
	let session = ctx.get(Session);
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let backToForm = routes.app.team.monitorsImport.href({ team: ctx.team.slug });

	let result = await validate(ctx.formData, ImportMonitorsSchema);
	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.i18next.t("actions.importMonitors.errors.generic"),
		});
		return redirect(backToForm, { status: redirect.Status.SeeOther });
	}

	let plan = parseMonitorImportList(result.data.urls);

	let db = getServiceContainer().get(Database);
	for (let candidate of plan.accepted) {
		await Monitor.create(db, ctx.team.id, viewer.id, {
			name: candidate.name,
			url: candidate.url,
			interval_seconds: result.data.interval_seconds,
		});
	}

	let report: MonitorImportReport = {
		created: plan.accepted.length,
		rejected: plan.rejected,
		overflow: plan.overflow,
	};
	let hasProblems = report.rejected.length > 0 || report.overflow > 0;

	if (!hasProblems && report.created > 0) {
		session?.flash("toast", {
			intent: "success",
			message: ctx.i18next.t("actions.importMonitors.success", { count: report.created }),
		});
		return redirect(routes.app.team.monitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	session?.flash(MONITOR_IMPORT_REPORT, report);
	session?.flash("toast", {
		/**
		 * Any created monitor makes this a success, however many lines were rejected
		 * alongside it — those monitors exist, and this toast is where that gets said.
		 */
		intent: report.created > 0 ? "success" : "error",
		message:
			report.created > 0
				? ctx.i18next.t("actions.importMonitors.partial", {
						count: report.created,
						rejected: report.rejected.length + report.overflow,
					})
				: ctx.i18next.t("actions.importMonitors.errors.none"),
	});
	return redirect(backToForm, { status: redirect.Status.SeeOther });
});

export default importMonitors;
