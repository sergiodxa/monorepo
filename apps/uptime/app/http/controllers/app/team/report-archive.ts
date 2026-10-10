/**
 * Team report archive: both uptime reports as CSVs in one ZIP, for a team that sends a client
 * the month's summary and its daily detail together. Same access, query and dialect as the
 * single-report download; each report streams from the roll-up into the archive in turn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { attachment, redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { dailyCsv, reportArchiveFilename, reportFilename, summaryCsv } from "~/app/lib/report-csv";
import { reportDialect } from "~/app/lib/report-dialect";
import { resolveReportRequest } from "~/app/lib/report-request";
import { dailyRows, summaryRows } from "~/app/repositories/reports";
import routes from "~/routes/web";

/**
 * GET /app/:team/reports.zip — the summary and the daily report as two CSVs in one ZIP, named
 * as the single downloads name them. A query the reports cannot use redirects back to the
 * builder with the same query. Entries carry the download time, so an unarchiver shows when
 * the files were made; the archive stores them uncompressed.
 */
export default createAction(routes.app.team.reports.archive, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let request = await resolveReportRequest(ctx.models, ctx.team.id, ctx.url.searchParams);
		if (isFailure(request)) {
			let builder = routes.app.team.reports.index.href({ team: ctx.team.slug });
			return redirect(`${builder}${ctx.url.search}`);
		}

		let { filter, range, dialect: dialectName } = request.data;
		let dialect = reportDialect(ctx.locale, dialectName);
		let modified = new Date();
		let zip = new Zip();

		let summary = zip.add(
			reportFilename(ctx.team.slug, "uptime-summary", range),
			summaryCsv(await summaryRows(ctx.db, ctx.team.id, filter), dialect, ctx.intl.t),
			{ modified },
		);
		let daily = zip.add(
			reportFilename(ctx.team.slug, "uptime-daily", range),
			dailyCsv(dailyRows(ctx.db, ctx.team.id, filter), dialect, ctx.intl.t),
			{ modified },
		);
		for (let added of [summary, daily]) {
			if (isFailure(added)) {
				ctx.log.fail(added.error, { report: { archive: added.error.code } });
				return new Response("The report archive could not be assembled.", { status: 500 });
			}
		}

		return new Response(zip.stream(), {
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": attachment(reportArchiveFilename(ctx.team.slug, range)),
				"Cache-Control": "no-store",
			},
		});
	},
});
