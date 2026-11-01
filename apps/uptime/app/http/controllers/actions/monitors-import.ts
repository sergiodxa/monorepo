/**
 * `POST /actions/:team/import-monitors` — creates one monitor per URL in a pasted list. Every
 * URL goes through the same validation and the same `monitors.create` the single-monitor form
 * uses, so an imported monitor is indistinguishable from a hand-made one and no second creatio
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { ValidationError } from "@sdxc/validate";

import { redirect } from "@sdxc/http/response";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { MonitorsImportForm } from "~/app/http/controllers/app/team/monitors-import";
import type { MonitorImportReport } from "~/app/http/validators/monitor-import";

import { renderMonitorsImportPage } from "~/app/http/controllers/app/team/monitors-import";
import { getViewer } from "~/app/http/middleware/auth";
import {
	ImportMonitorsSchema,
	MAX_IMPORT_LINES,
	parseMonitorImportList,
} from "~/app/http/validators/monitor-import";
import routes from "~/routes/web";

/**
 * Session key the import page reads its one-time report from.
 *
 * The session carries the report because it holds the lines somebody pasted, and a session
 * read is private and single-use — matching a report that is meant for exactly one render.
 */
export const MONITOR_IMPORT_REPORT = "monitorImport";

/** The status a redrawn form answers with: the request was understood, its values were not. */
const INVALID_FORM_STATUS = 400;

/** The fields the import form posts. */
const IMPORT_FIELDS = ["urls", "interval_seconds"] as const;

/** What a submission typed into each field, as posted, so a redraw shows it unchanged. */
function submittedValues(form: FormData): NonNullable<MonitorsImportForm["values"]> {
	let values: NonNullable<MonitorsImportForm["values"]> = {};
	for (let field of IMPORT_FIELDS) {
		let value = form.get(field);
		if (typeof value === "string") values[field] = value;
	}
	return values;
}

/** The translated message for each field a validation failure names. */
function fieldErrors(
	error: ValidationError,
	t: Translate,
): NonNullable<MonitorsImportForm["errors"]> {
	let errors: NonNullable<MonitorsImportForm["errors"]> = {};
	for (let issue of error.issues) {
		let segment = issue.path?.[0];
		let key = typeof segment === "object" && segment !== null ? segment.key : segment;
		if (key === "urls") {
			errors.urls = t("page.monitorForm.errors.importUrls", { limit: MAX_IMPORT_LINES });
		}
		if (key === "interval_seconds") errors.interval_seconds = t("page.monitorForm.errors.interval");
	}
	return errors;
}

/**
 * Created monitors rely on the every-minute scheduler for their first check: `monitors.create`
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
		return renderMonitorsImportPage(
			{
				values: submittedValues(ctx.formData),
				errors: fieldErrors(result.error, ctx.intl.t),
			},
			{ status: INVALID_FORM_STATUS },
		);
	}

	let plan = parseMonitorImportList(result.data.urls);

	for (let candidate of plan.accepted) {
		unwrap(
			await ctx.models.monitors.create({
				team_id: ctx.team.id,
				author_id: viewer.id,
				name: candidate.name,
				url: candidate.url,
				interval_seconds: result.data.interval_seconds,
			}),
		);
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
			message: ctx.intl.t("actions.importMonitors.success", { count: report.created }),
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
				? ctx.intl.t("actions.importMonitors.partial", {
						count: report.created,
						rejected: report.rejected.length + report.overflow,
					})
				: ctx.intl.t("actions.importMonitors.errors.none"),
	});
	return redirect(backToForm, { status: redirect.Status.SeeOther });
});

export default importMonitors;
