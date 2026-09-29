/**
 * API v1 uptime reports: `GET /api/v1/reports/uptime-summary` and `/uptime-daily`, behind
 * `reports:read`. `Accept: text/csv` streams the standard dialect for the whole range; JSON,
 * the default, wraps the same rows in the envelope, the daily rows paged by cursor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { RequestContext } from "remix/router";

import { vary } from "@sdxc/http/cache";
import { accepts } from "@sdxc/http/negotiate";
import { attachment, csv } from "@sdxc/http/response";
import { decodeCursor, encodeCursor, InvalidCursorError } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { ReportKind } from "~/app/lib/report-csv";
import type { ReportRange, ReportRangeProblem } from "~/app/lib/report-range";

import Report from "~/app/data/report";
import StatusPage from "~/app/data/status-page";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { REPORT_QUERY } from "~/app/http/openapi/reports";
import { dailyCsv, reportFilename, summaryCsv } from "~/app/lib/report-csv";
import { reportDialect } from "~/app/lib/report-dialect";
import { checkRange, MAX_REPORT_DAYS, presetRange } from "~/app/lib/report-range";
import { REPORT_MONITOR_TYPES } from "~/app/lib/report-request";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, PAGING } from "~/app/services/pagination";
import { encodeMonitorId } from "~/app/services/typed-id";
import { reportsRoutes } from "~/routes/api-groups";

/** The API writes RFC 4180 with the column keys as headers, the same in every locale. */
const STANDARD_DIALECT = reportDialect("en", "standard");

/**
 * The daily cursor's keys, the report's own order: the monitor's type position, its name,
 * its id, then the day. A cursor carries the boundary row's values, so a monitor deleted
 * between pages leaves the rest of the walk where it was.
 */
const DAILY_CURSOR_COLUMNS = ["type", "monitor", "monitorId", "date"] as const;

/** Where a row sits in the daily report's order, as a cursor records it. */
interface DailyKey {
	typeOrder: number;
	monitor: string;
	monitorId: string;
	date: string;
}

/** A decoded daily cursor: the boundary row and which side of it the page lies on. */
interface DailyBoundary {
	direction: "after" | "before";
	key: DailyKey;
}

/** One page of daily rows and whether pages lie on either side of it. */
interface DailyPage {
	items: Report.DailyRow[];
	hasNext: boolean;
	hasPrev: boolean;
}

/**
 * The column keys are written untranslated in the standard dialect, the only one the API
 * sends, so its translator hands every key back as it came.
 */
function untranslated(key: string): string {
	return key;
}

/** What each rule `checkRange` enforces tells a caller, with the parameter it names. */
const RANGE_MESSAGES: Record<ReportRangeProblem, { message: string; pointer: string }> = {
	invalid: { message: "from and to must be calendar days written as YYYY-MM-DD", pointer: "" },
	reversed: { message: "from must not be after to", pointer: "/from" },
	future: { message: "to must be yesterday (UTC) at the latest", pointer: "/to" },
	tooLong: { message: `The range covers at most ${MAX_REPORT_DAYS} days`, pointer: "" },
};

/**
 * Reads the query into a report filter. Omitting both ends reports last month; one end alone
 * is refused, since guessing the other would report a range nobody asked for. A status page
 * must be the team's own, answering 404 otherwise, as an id naming another team's page does.
 *
 * @param ctx - The request, after `requireApiKey("reports:read")`.
 * @returns The filter, or the problem response to answer with.
 */
async function readFilter(ctx: RequestContext): Promise<Report.Filter | Response> {
	let query = await validate(ctx.url.searchParams, REPORT_QUERY);
	if (isFailure(query)) {
		return apiProblems.validationError({
			instance: problemInstance(),
			extensions: { errors: issuesFrom(query.error) },
		});
	}

	let { from, to, status_page_id: statusPageId, monitor_type: monitorType } = query.data;
	if ((from === undefined) !== (to === undefined)) {
		return invalidField("from and to must be given together", from === undefined ? "/from" : "/to");
	}

	let requested: ReportRange =
		from !== undefined && to !== undefined ? { from, to } : presetRange("lastMonth");
	let range = checkRange(requested);
	if (isFailure(range)) {
		let { message, pointer } = RANGE_MESSAGES[range.error.problem];
		return invalidField(message, pointer);
	}

	if (statusPageId !== undefined) {
		let page = await StatusPage.findByIdForTeam(ctx.db, ctx.apiTeam.id, statusPageId);
		if (!page) {
			return apiProblems.notFound({ detail: "Status page not found", instance: problemInstance() });
		}
	}

	return { ...range.data, statusPageId, monitorType };
}

/**
 * Whether the caller asked for CSV over JSON. JSON comes first among the candidates, so a
 * wildcard, a missing `Accept` and one naming neither type all answer JSON.
 */
function wantsCsv(request: Request): boolean {
	return accepts(request).preferred("application/json", "text/csv") === "text/csv";
}

/**
 * The CSV download: streamed, named after the team and range, and kept out of every cache,
 * since it holds the team's history.
 *
 * @param body - The CSV bytes.
 * @param teamSlug - Names the file.
 * @param kind - Names the file.
 * @param range - Names the file.
 */
function csvDownload(
	body: ReadableStream<Uint8Array>,
	teamSlug: string,
	kind: ReportKind,
	range: ReportRange,
): Response {
	return csv(body, {
		headers: {
			"Content-Disposition": attachment(reportFilename(teamSlug, kind, range)),
			"Cache-Control": "no-store",
			Vary: "Accept",
		},
	});
}

/** A JSON answer marked as one of the two forms `Accept` chooses between. */
function negotiated(response: Response): Response {
	vary(response.headers, ["Accept"]);
	return response;
}

/** One summary row in the API's camelCase shape, its monitor id prefixed by its type. */
function serializeSummaryRow(row: Report.SummaryRow) {
	return {
		monitorId: encodeMonitorId(row.type, row.monitorId),
		monitor: row.monitor,
		type: row.type,
		target: row.target,
		daysWithData: row.daysWithData,
		totalChecks: row.totalChecks,
		successfulChecks: row.successfulChecks,
		failedChecks: row.failedChecks,
		uptimePercent: row.uptimePercent,
		avgResponseTimeMs: row.avgResponseTimeMs,
		maxResponseTimeMs: row.maxResponseTimeMs,
		daysDown: row.daysDown,
		daysDegraded: row.daysDegraded,
		maintenanceMinutes: row.maintenanceMinutes,
	};
}

/** One daily row in the API's camelCase shape, its monitor id prefixed by its type. */
function serializeDailyRow(row: Report.DailyRow) {
	return {
		date: row.date,
		monitorId: encodeMonitorId(row.type, row.monitorId),
		monitor: row.monitor,
		type: row.type,
		totalChecks: row.totalChecks,
		successfulChecks: row.successfulChecks,
		failedChecks: row.failedChecks,
		uptimePercent: row.uptimePercent,
		avgResponseTimeMs: row.avgResponseTimeMs,
		maxResponseTimeMs: row.maxResponseTimeMs,
		status: row.status,
		maintenanceMinutes: row.maintenanceMinutes,
	};
}

/** A daily row's place in the report's order. */
function dailyKey(row: Report.DailyRow): DailyKey {
	return {
		typeOrder: REPORT_MONITOR_TYPES.indexOf(row.type),
		monitor: row.monitor,
		monitorId: row.monitorId,
		date: row.date,
	};
}

/**
 * Orders two strings by code point, which is how SQLite's default collation orders the
 * UTF-8 names `Report.listMonitors` sorts by, so the cursor agrees with the query.
 */
function compareCodePoints(a: string, b: string): number {
	let left = Array.from(a, (char) => char.codePointAt(0) ?? 0);
	let right = Array.from(b, (char) => char.codePointAt(0) ?? 0);
	for (let [index, point] of left.entries()) {
		let other = right[index];
		if (other === undefined) return 1;
		if (point !== other) return point - other;
	}
	return left.length - right.length;
}

/** Compares two rows' places: negative when `a` comes first, zero for the same row. */
function compareDailyKeys(a: DailyKey, b: DailyKey): number {
	return (
		a.typeOrder - b.typeOrder ||
		compareCodePoints(a.monitor, b.monitor) ||
		compareCodePoints(a.monitorId, b.monitorId) ||
		compareCodePoints(a.date, b.date)
	);
}

/**
 * Reads a daily cursor. One minted for another ordering, or carrying values of the wrong
 * kind, is refused like one that does not decode.
 *
 * @param cursor - The `cursor` parameter.
 * @returns The boundary, or `InvalidCursorError`.
 */
function readDailyCursor(cursor: string): Result<DailyBoundary, InvalidCursorError> {
	let decoded = decodeCursor(cursor);
	if (isFailure(decoded)) return decoded;

	let { columns, values, direction } = decoded.data;
	let [typeOrder, monitor, monitorId, date] = values;
	if (
		columns.join() !== DAILY_CURSOR_COLUMNS.join() ||
		typeof typeOrder !== "number" ||
		typeof monitor !== "string" ||
		typeof monitorId !== "string" ||
		typeof date !== "string"
	) {
		return failure(new InvalidCursorError("minted for another ordering"));
	}

	return success({ direction, key: { typeOrder, monitor, monitorId, date } });
}

/**
 * A cursor at `row`, for the page on `direction`'s side of it.
 *
 * @param direction - `after` for the following page, `before` for the preceding one.
 * @param row - The page's last or first row.
 */
function dailyCursor(direction: "after" | "before", row: Report.DailyRow): string | null {
	let key = dailyKey(row);
	let encoded = encodeCursor(direction, DAILY_CURSOR_COLUMNS, [
		key.typeOrder,
		key.monitor,
		key.monitorId,
		key.date,
	]);
	return isFailure(encoded) ? null : encoded.data;
}

/**
 * One page of the daily report, read from the stream in the report's order. Rows before a
 * forward boundary are read and dropped; a backward page keeps a window of `limit + 1` rows
 * and stops at the boundary, so memory stays bounded by the page either way.
 *
 * @param rows - The report's rows, as `Report.dailyRows` yields them.
 * @param boundary - The decoded cursor, or `null` for the first page.
 * @param limit - Rows per page.
 */
async function readDailyPage(
	rows: AsyncIterable<Report.DailyRow>,
	boundary: DailyBoundary | null,
	limit: number,
): Promise<DailyPage> {
	if (boundary?.direction === "before") {
		let window: Report.DailyRow[] = [];
		for await (let row of rows) {
			if (compareDailyKeys(dailyKey(row), boundary.key) >= 0) break;
			window.push(row);
			if (window.length > limit + 1) window.shift();
		}
		return { items: window.slice(-limit), hasNext: true, hasPrev: window.length > limit };
	}

	let items: Report.DailyRow[] = [];
	for await (let row of rows) {
		if (boundary && compareDailyKeys(dailyKey(row), boundary.key) <= 0) continue;
		items.push(row);
		if (items.length > limit) break;
	}
	return {
		items: items.slice(0, limit),
		hasNext: items.length > limit,
		hasPrev: boundary !== null,
	};
}

export default createController(reportsRoutes, {
	actions: {
		/**
		 * GET /api/v1/reports/uptime-summary — one row per monitor over the range. JSON sends
		 * every monitor in one response, since the list is as long as the team's monitors.
		 */
		reportsUptimeSummary: {
			middleware: [requireApiKey("reports:read")],
			handler: async (ctx) => {
				let filter = await readFilter(ctx);
				if (filter instanceof Response) return filter;

				let rows = await Report.summaryRows(ctx.db, ctx.apiTeam.id, filter);
				if (wantsCsv(ctx.request)) {
					let body = summaryCsv(rows, STANDARD_DIALECT, untranslated);
					return csvDownload(body, ctx.apiTeam.slug, "uptime-summary", filter);
				}

				return negotiated(
					apiSuccess({
						from: filter.from,
						to: filter.to,
						monitors: rows.map(serializeSummaryRow),
					}),
				);
			},
		},

		/**
		 * GET /api/v1/reports/uptime-daily — one row per monitor per day with a roll-up row.
		 * CSV streams the whole range; JSON pages by a cursor on the report's order.
		 */
		reportsUptimeDaily: {
			middleware: [requireApiKey("reports:read")],
			handler: async (ctx) => {
				let filter = await readFilter(ctx);
				if (filter instanceof Response) return filter;

				if (wantsCsv(ctx.request)) {
					let body = dailyCsv(
						Report.dailyRows(ctx.db, ctx.apiTeam.id, filter),
						STANDARD_DIALECT,
						untranslated,
					);
					return csvDownload(body, ctx.apiTeam.slug, "uptime-daily", filter);
				}

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params)) {
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});
				}

				let boundary: DailyBoundary | null = null;
				if (params.data.cursor !== null) {
					let decoded = readDailyCursor(params.data.cursor);
					if (isFailure(decoded)) {
						return apiProblems.badRequest({
							detail: decoded.error.message,
							instance: problemInstance(),
						});
					}
					boundary = decoded.data;
				}

				let page = await readDailyPage(
					Report.dailyRows(ctx.db, ctx.apiTeam.id, filter),
					boundary,
					params.data.perPage,
				);
				let first = page.items.at(0);
				let last = page.items.at(-1);

				return negotiated(
					apiPage(
						{
							from: filter.from,
							to: filter.to,
							days: page.items.map(serializeDailyRow),
						},
						{
							items: page.items,
							cursors: {
								next: page.hasNext && last ? dailyCursor("after", last) : null,
								prev: page.hasPrev && first ? dailyCursor("before", first) : null,
							},
						},
						{ url: ctx.url, perPage: params.data.perPage },
					),
				);
			},
		},
	},
});
