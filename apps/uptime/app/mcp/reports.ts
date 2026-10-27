/**
 * Report helpers for MCP tools: the same filter rules and row shapes as the REST report
 * endpoints, without Accept-based CSV negotiation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DayRange } from "@sdxc/dates";
import type { Result } from "@sdxc/result";

import { ToolError } from "@sdxc/mcp";
import { decodeCursor, encodeCursor, InvalidCursorError } from "@sdxc/pagination";
import { failure, isFailure, success } from "@sdxc/result";

import type { UptimeModels } from "~/app/models";
import type { Report } from "~/app/models/reports";
import type { ReportRangeProblem } from "~/app/services/reports/range";

import { checkRange, MAX_REPORT_DAYS, presetRange } from "~/app/services/reports/range";
import { REPORT_MONITOR_TYPES } from "~/app/services/reports/request";
import { encodeMonitorId } from "~/app/services/typed-id";

/** The daily cursor's keys, matching the REST daily report. */
const DAILY_CURSOR_COLUMNS = ["type", "monitor", "monitorId", "date"] as const;

/** Where a row sits in the daily report's order. */
interface DailyKey {
	typeOrder: number;
	monitor: string;
	monitorId: string;
	date: string;
}

/** A decoded daily cursor. */
interface DailyBoundary {
	direction: "after" | "before";
	key: DailyKey;
}

/** What each range refusal tells the model. */
const RANGE_MESSAGES: Record<ReportRangeProblem, string> = {
	invalid: "from and to must be calendar days written as YYYY-MM-DD",
	reversed: "from must not be after to",
	future: "to must be yesterday (UTC) at the latest",
	tooLong: `The range covers at most ${MAX_REPORT_DAYS} days`,
};

/** Filter arguments both report tools accept. */
export interface ReportFilterInput {
	from?: string;
	to?: string;
	status_page_id?: string;
	monitor_type?: (typeof REPORT_MONITOR_TYPES)[number];
}

/**
 * Reads tool arguments into a report filter, throwing a {@link ToolError} the model can act on.
 *
 * @param models - The request's models.
 * @param teamId - The calling key's team.
 * @param input - The tool's filter fields.
 */
export async function readReportFilter(
	models: UptimeModels,
	teamId: string,
	input: ReportFilterInput,
): Promise<Report.Filter> {
	let { from, to, status_page_id: statusPageId, monitor_type: monitorType } = input;
	if ((from === undefined) !== (to === undefined)) {
		throw new ToolError("from and to must be given together");
	}

	let requested: DayRange =
		from !== undefined && to !== undefined ? { from, to } : presetRange("lastMonth");
	let range = checkRange(requested);
	if (isFailure(range)) throw new ToolError(RANGE_MESSAGES[range.error.problem]);

	if (statusPageId !== undefined) {
		let page = await models.statusPages.inTeam(teamId).find(statusPageId);
		if (!page) throw new ToolError("Status page not found");
	}

	return { ...range.data, statusPageId, monitorType };
}

/** One summary row in the API's camelCase shape. */
export function serializeSummaryRow(row: Report.SummaryRow) {
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

/** One daily row in the API's camelCase shape. */
export function serializeDailyRow(row: Report.DailyRow) {
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

function compareDailyKeys(a: DailyKey, b: DailyKey): number {
	return (
		a.typeOrder - b.typeOrder ||
		compareCodePoints(a.monitor, b.monitor) ||
		compareCodePoints(a.monitorId, b.monitorId) ||
		compareCodePoints(a.date, b.date)
	);
}

function readDailyCursor(
	cursor: string,
): Result<{ direction: "after" | "before"; key: DailyKey }, InvalidCursorError> {
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
 * One page of the daily report in the report's own order.
 *
 * @param rows - Rows as `dailyRows` yields them.
 * @param cursor - Optional page cursor from a previous call.
 * @param limit - Rows per page.
 */
export async function pageDailyRows(
	rows: AsyncIterable<Report.DailyRow>,
	cursor: string | undefined,
	limit: number,
): Promise<{
	items: Report.DailyRow[];
	nextCursor: string | null;
	prevCursor: string | null;
}> {
	let boundary: DailyBoundary | null = null;
	if (cursor !== undefined) {
		let decoded = readDailyCursor(cursor);
		if (isFailure(decoded)) throw new ToolError(`Invalid cursor: ${decoded.error.message}`);
		boundary = decoded.data;
	}

	if (boundary?.direction === "before") {
		let window: Report.DailyRow[] = [];
		for await (let row of rows) {
			if (compareDailyKeys(dailyKey(row), boundary.key) >= 0) break;
			window.push(row);
			if (window.length > limit + 1) window.shift();
		}
		let items = window.slice(-limit);
		let first = items.at(0);
		let last = items.at(-1);
		return {
			items,
			nextCursor: last ? dailyCursor("after", last) : null,
			prevCursor: window.length > limit && first ? dailyCursor("before", first) : null,
		};
	}

	let items: Report.DailyRow[] = [];
	for await (let row of rows) {
		if (boundary && compareDailyKeys(dailyKey(row), boundary.key) <= 0) continue;
		items.push(row);
		if (items.length > limit) break;
	}
	let pageItems = items.slice(0, limit);
	let first = pageItems.at(0);
	let last = pageItems.at(-1);
	return {
		items: pageItems,
		nextCursor: items.length > limit && last ? dailyCursor("after", last) : null,
		prevCursor: boundary !== null && first ? dailyCursor("before", first) : null,
	};
}
