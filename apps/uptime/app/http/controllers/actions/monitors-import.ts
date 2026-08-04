/**
 * `POST /actions/:team/import-monitors` — creates one monitor per URL in a pasted list.
 *
 * Every URL goes through the same validation and the same `Monitor.create` the single-monitor
 * form uses, so an imported monitor is indistinguishable from a hand-made one and no second
 * creation path exists to drift from the first.
 *
 * A partial success is the expected outcome, not an error: somebody pasting thirty lines off a
 * spreadsheet will have a stray blank, a duplicate, and something that isn't a URL among them.
 * Refusing the whole submission over one bad line would make the feature useless precisely
 * when it is most needed, so the good lines are created and the bad ones are reported back
 * with their reasons.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import type { MonitorImportReport } from "~/app/http/validators/monitor-import";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import { ImportMonitorsSchema, parseMonitorImportList } from "~/app/http/validators/monitor-import";
import routes from "~/routes/web";

/**
 * Session key the import page reads its one-time report from.
 *
 * The report travels in the session rather than in the query string because it holds the lines
 * somebody pasted, and a URL is the one place those should never end up: it is logged, shared
 * and bookmarked, and the report is for a single render.
 */
export const MONITOR_IMPORT_REPORT = "monitorImport";

/**
 * POST /actions/:team/import-monitors — creates a monitor for every valid, distinct URL in the
 * pasted list, then redirects.
 *
 * Where it redirects is part of the report: back to the paste box whenever anything was
 * rejected, so the lines to fix sit in front of the box they get re-pasted into, and on to the
 * monitor list when the whole list landed, since there is then nothing left to do here.
 *
 * No on-demand check is enqueued for the created monitors, unlike the single-monitor create.
 * `Monitor.create` stamps `next_due_at` at now, so the every-minute scheduler claims all of
 * them on its next tick; spending a subscription lookup and a queue message per line to save
 * at most that one minute would make this request's cost scale with the length of the list,
 * which is the one thing that makes this path different from creating one monitor.
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
		 * A submission where nothing landed at all is the error; one where some of it did is
		 * not, however many lines were rejected alongside — those monitors exist, and this
		 * toast is where that gets said.
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
