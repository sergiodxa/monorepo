/**
 * Turns the report builder's query into what the report reads: a checked range, a monitor
 * filter that belongs to the team, and a dialect. The page and the download both resolve
 * through here, so a query the download rejects is the one the page explains.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import type { DailyStatsMonitorType } from "~/app/data/monitor-daily-stats";
import type Report from "~/app/data/report";
import type { ReportDialectName } from "~/app/lib/report-dialect";
import type { ReportRange, ReportRangeProblem } from "~/app/lib/report-range";

import StatusPage from "~/app/data/status-page";
import { ReportQuerySchema } from "~/app/http/validators/report";
import { checkRange, presetRange } from "~/app/lib/report-range";

/**
 * The monitor types a report covers, in the order every report lists them; a monitor's
 * position here is also the first key of the API's daily report cursor.
 */
export const REPORT_MONITOR_TYPES = [
	"http",
	"dns",
	"tcp",
	"cron",
	"flow",
] as const satisfies readonly DailyStatsMonitorType[];

/**
 * Why a query cannot be reported on: a range rule, or a monitor filter the team does not
 * own. Used as the last segment of `page.reports.errors.*`.
 */
export type ReportRequestProblem = ReportRangeProblem | "scope";

/**
 * Carries the problem to the builder, which re-renders with its message.
 */
export class ReportRequestError extends Error {
	override name = "ReportRequestError";
	problem: ReportRequestProblem;

	/**
	 * @param problem - What is wrong with the query
	 */
	constructor(problem: ReportRequestProblem) {
		super(`Invalid report request: ${problem}`);
		this.problem = problem;
	}
}

/**
 * A query resolved against the team.
 */
export interface ReportRequest {
	range: ReportRange;
	filter: Report.Filter;
	dialect: ReportDialectName;
	/** The `monitors` control's value, echoed back so the builder keeps the selection. */
	monitors: string;
}

/**
 * Resolves the builder's query. Without `from` and `to` the range is last month, the
 * builder's default; with only one of them the query is invalid.
 *
 * @param db - The team's database
 * @param teamId - The team the report is for
 * @param params - The request's query string
 * @param now - The current instant in epoch milliseconds
 * @returns The request, or the problem the builder shows
 */
export async function resolveReportRequest(
	db: Database,
	teamId: string,
	params: URLSearchParams,
	now: number = Date.now(),
): Promise<Result<ReportRequest, ReportRequestError>> {
	let query = await validate(params, ReportQuerySchema);
	if (isFailure(query)) return failure(new ReportRequestError("invalid"));

	let { from, to, monitors, dialect } = query.data;
	let range: ReportRange;
	if (from === undefined && to === undefined) {
		range = presetRange("lastMonth", now);
	} else {
		let checked = checkRange({ from: from ?? "", to: to ?? "" }, now);
		if (isFailure(checked)) return failure(new ReportRequestError(checked.error.problem));
		range = checked.data;
	}

	let scope = await resolveMonitorScope(db, teamId, monitors);
	if (scope === null) return failure(new ReportRequestError("scope"));

	return success({ range, filter: { ...range, ...scope }, dialect, monitors });
}

/**
 * Whether a query came from a submission, as opposed to a first visit to the builder,
 * so the page shows an error only for something the person sent.
 *
 * @param params - The request's query string
 * @returns `true` when any builder field is present
 */
export function isSubmitted(params: URLSearchParams): boolean {
	return ["from", "to", "monitors", "dialect"].some((name) => params.has(name));
}

/**
 * Reads the `monitors` control's value into a filter, checking a status page is the team's.
 *
 * @param db - The team's database
 * @param teamId - The team the report is for
 * @param value - `all`, `status-page:<id>` or `type:<monitor type>`
 * @returns The filter fields, or `null` for a value the team cannot use
 */
async function resolveMonitorScope(
	db: Database,
	teamId: string,
	value: string,
): Promise<Pick<Report.Filter, "statusPageId" | "monitorType"> | null> {
	if (value === "all") return {};

	if (value.startsWith("type:")) {
		let type = value.slice("type:".length);
		let known = REPORT_MONITOR_TYPES.find((candidate) => candidate === type);
		return known ? { monitorType: known } : null;
	}

	if (value.startsWith("status-page:")) {
		let statusPageId = value.slice("status-page:".length);
		let page = await StatusPage.findByIdForTeam(db, teamId, statusPageId);
		return page ? { statusPageId } : null;
	}

	return null;
}
