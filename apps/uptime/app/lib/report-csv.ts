/**
 * Writes the uptime reports as CSV, shared by the team download and `/api/v1/reports`, so
 * both send the same columns in the same dialect rules. Column keys are the stable standard
 * headers; the spreadsheet dialect swaps in translated headers, types and statuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cell, Column } from "@sdxc/csv";
import type { DayRange } from "@sdxc/dates";
import type { Translate } from "@sdxc/i18n";

import { streamify } from "@sdxc/csv";
import { isWholeMonth } from "@sdxc/dates";

import type { ReportDialect } from "~/app/lib/report-dialect";
import type { Report } from "~/app/repositories/reports";

import { numberCell } from "~/app/lib/report-dialect";

/** The reports a team can download, as they appear in the download URL and filename. */
export const REPORT_KINDS = ["uptime-summary", "uptime-daily"] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

/** The summary's columns in order, keyed as the standard dialect's headers. */
const SUMMARY_KEYS = [
	"monitor",
	"type",
	"target",
	"days_with_data",
	"total_checks",
	"successful_checks",
	"failed_checks",
	"uptime_percent",
	"avg_response_time_ms",
	"max_response_time_ms",
	"days_down",
	"days_degraded",
	"maintenance_minutes",
] as const;

/** The daily report's columns in order, keyed as the standard dialect's headers. */
const DAILY_KEYS = [
	"date",
	"monitor",
	"type",
	"total_checks",
	"successful_checks",
	"failed_checks",
	"uptime_percent",
	"avg_response_time_ms",
	"max_response_time_ms",
	"status",
	"maintenance_minutes",
] as const;

type SummaryKey = (typeof SUMMARY_KEYS)[number];
type DailyKey = (typeof DAILY_KEYS)[number];

/**
 * Streams the uptime summary as CSV.
 *
 * @param rows - One row per monitor, as `summaryRows` returns them
 * @param dialect - How the file is written
 * @param t - Translates headers, types and statuses in the spreadsheet dialect
 * @returns The CSV bytes
 */
export function summaryCsv(
	rows: Iterable<Report.SummaryRow>,
	dialect: ReportDialect,
	t: Translate,
): ReadableStream<Uint8Array> {
	return streamify(
		mapRows(rows, (row) => summaryCells(row, dialect, t)),
		{
			columns: columns(SUMMARY_KEYS, dialect, t),
			delimiter: dialect.delimiter,
			bom: dialect.bom,
		},
	);
}

/**
 * Streams the daily report as CSV while the rows are read.
 *
 * @param rows - The daily rows, as `dailyRows` yields them
 * @param dialect - How the file is written
 * @param t - Translates headers, types and statuses in the spreadsheet dialect
 * @returns The CSV bytes
 */
export function dailyCsv(
	rows: AsyncIterable<Report.DailyRow>,
	dialect: ReportDialect,
	t: Translate,
): ReadableStream<Uint8Array> {
	return streamify(
		mapRows(rows, (row) => dailyCells(row, dialect, t)),
		{
			columns: columns(DAILY_KEYS, dialect, t),
			delimiter: dialect.delimiter,
			bom: dialect.bom,
		},
	);
}

/**
 * The download's filename: the team, the report and the range, with a whole month written
 * as `2026-08` so a client's monthly files sort together. It is the same in every locale.
 *
 * @param teamSlug - The team's slug
 * @param kind - The report
 * @param range - The range the report covers
 * @returns e.g. `acme-uptime-summary-2026-08.csv`
 */
export function reportFilename(teamSlug: string, kind: ReportKind, range: DayRange): string {
	return `${teamSlug}-${kind}-${reportPeriod(range)}.csv`;
}

/**
 * The name of the ZIP holding every report for a range, beside the CSV names it contains so
 * the archive and its files sort together.
 *
 * @param teamSlug - The team's slug
 * @param range - The range the reports cover
 * @returns e.g. `acme-uptime-reports-2026-08.zip`
 */
export function reportArchiveFilename(teamSlug: string, range: DayRange): string {
	return `${teamSlug}-uptime-reports-${reportPeriod(range)}.zip`;
}

/** A range as a filename writes it: `YYYY-MM` for a whole month, else first and last day. */
function reportPeriod(range: DayRange): string {
	return isWholeMonth(range) ? range.from.slice(0, 7) : `${range.from}_${range.to}`;
}

/**
 * The columns for a report, headed by their keys or, in the spreadsheet dialect, by the
 * translation under `page.reports.columns`.
 *
 * @param keys - The report's column keys in order
 * @param dialect - How the file is written
 * @param t - The translator
 * @returns The CSV columns
 */
function columns<Key extends string>(
	keys: readonly Key[],
	dialect: ReportDialect,
	t: Translate,
): Column<Record<Key, Cell>>[] {
	return keys.map((key) => ({
		key,
		header: dialect.translateHeaders ? t(`page.reports.columns.${key}`) : key,
	}));
}

/**
 * One summary row as cells.
 *
 * @param row - The summary row
 * @param dialect - How numbers and labels are written
 * @param t - The translator
 * @returns The cells by column key
 */
function summaryCells(
	row: Report.SummaryRow,
	dialect: ReportDialect,
	t: Translate,
): Record<SummaryKey, Cell> {
	return {
		monitor: row.monitor,
		type: typeLabel(row.type, dialect, t),
		target: row.target,
		days_with_data: row.daysWithData,
		total_checks: row.totalChecks,
		successful_checks: row.successfulChecks,
		failed_checks: row.failedChecks,
		uptime_percent: numberCell(row.uptimePercent, dialect),
		avg_response_time_ms: numberCell(row.avgResponseTimeMs, dialect),
		max_response_time_ms: numberCell(row.maxResponseTimeMs, dialect),
		days_down: row.daysDown,
		days_degraded: row.daysDegraded,
		maintenance_minutes: row.maintenanceMinutes,
	};
}

/**
 * One daily row as cells.
 *
 * @param row - The daily row
 * @param dialect - How numbers and labels are written
 * @param t - The translator
 * @returns The cells by column key
 */
function dailyCells(
	row: Report.DailyRow,
	dialect: ReportDialect,
	t: Translate,
): Record<DailyKey, Cell> {
	return {
		date: row.date,
		monitor: row.monitor,
		type: typeLabel(row.type, dialect, t),
		total_checks: row.totalChecks,
		successful_checks: row.successfulChecks,
		failed_checks: row.failedChecks,
		uptime_percent: numberCell(row.uptimePercent, dialect),
		avg_response_time_ms: numberCell(row.avgResponseTimeMs, dialect),
		max_response_time_ms: numberCell(row.maxResponseTimeMs, dialect),
		status: dialect.translateHeaders ? t(`page.reports.statuses.${row.status}`) : row.status,
		maintenance_minutes: row.maintenanceMinutes,
	};
}

/**
 * A monitor type as a reader sees it: the translated name in a spreadsheet, the stable
 * value (`http`, `dns`, …) in the standard dialect.
 *
 * @param type - The monitor type
 * @param dialect - How the file is written
 * @param t - The translator
 * @returns The cell text
 */
function typeLabel(type: Report.Monitor["type"], dialect: ReportDialect, t: Translate): string {
	return dialect.translateHeaders ? t(`page.reports.types.${type}`) : type;
}

/**
 * Maps a sync or async source lazily, so a streamed report converts each row as it is read.
 *
 * @param rows - The source rows
 * @param map - Turns one row into cells
 * @yields Each mapped row in order
 */
async function* mapRows<Row, Mapped>(
	rows: Iterable<Row> | AsyncIterable<Row>,
	map: (row: Row) => Mapped,
): AsyncGenerator<Mapped> {
	for await (let row of rows) yield map(row);
}
