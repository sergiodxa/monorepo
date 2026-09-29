/**
 * Team report downloads. Requires `requireUser` + `requireTeam`; any member downloads,
 * since a report shows nothing the dashboard does not. The daily report streams from the
 * roll-up one monitor at a time, so a year of rows is never held in memory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { attachment, csv, redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Report from "~/app/data/report";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { dailyCsv, REPORT_KINDS, reportFilename, summaryCsv } from "~/app/lib/report-csv";
import { reportDialect } from "~/app/lib/report-dialect";
import { resolveReportRequest } from "~/app/lib/report-request";
import routes from "~/routes/web";

/**
 * GET /app/:team/reports/:report.csv — the report as CSV, in the dialect the builder chose.
 * An unknown report 404s. A query the report cannot use redirects back to the builder with
 * the same query, which renders the problem next to the fields that caused it.
 */
export default createAction(routes.app.team.reports.download, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { report } = s.parse(s.object({ report: s.string() }), ctx.params);
		let kind = REPORT_KINDS.find((candidate) => candidate === report);
		if (!kind) return notFound("Not Found");

		let request = await resolveReportRequest(ctx.db, ctx.team.id, ctx.url.searchParams);
		if (isFailure(request)) {
			let builder = routes.app.team.reports.index.href({ team: ctx.team.slug });
			return redirect(`${builder}${ctx.url.search}`);
		}

		let { filter, range, dialect: dialectName } = request.data;
		let dialect = reportDialect(ctx.locale, dialectName);
		let body =
			kind === "uptime-summary"
				? summaryCsv(await Report.summaryRows(ctx.db, ctx.team.id, filter), dialect, ctx.intl.t)
				: dailyCsv(Report.dailyRows(ctx.db, ctx.team.id, filter), dialect, ctx.intl.t);

		return csv(body, {
			headers: {
				"Content-Disposition": attachment(reportFilename(ctx.team.slug, kind, range)),
				"Cache-Control": "no-store",
			},
		});
	},
});
