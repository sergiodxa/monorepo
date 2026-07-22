/**
 * Calendar-year uptime heatmap: one column per week, one cell per day, colored by
 * that day's success rate (`successful_checks / total_checks`) on a graded scale
 * across `@pkg/r3-ui`'s semantic color tokens — `--ui-success-*` (was "up"/green),
 * shading through `--ui-warning-*` (was "mixed"/amber) down to `--ui-danger-*` (was
 * "failure"/red), with `--ui-neutral-*` when a day has no data — instead of the
 * app's old ad-hoc `oklch(...)` literals, so the grid reads consistently with every
 * other r3-ui-based surface. Weeks start on Sunday and cover the full current year,
 * from January 1st through December 31st (days beyond today simply render as "no
 * data"). Row labels for Monday/Wednesday/Friday sit to the left of the grid, a
 * date-range caption above it, and a color-scale legend below it. Cells are a fixed
 * 16px square, matching a full year's worth of columns naturally produces a grid
 * wide enough to fill most container widths; on narrower viewports the grid scrolls
 * horizontally instead of shrinking.
 *
 * The weekday row labels, the legend's "Success"/"Mixed"/"Failure"/"No data" copy,
 * and the per-cell tooltip title template are still hardcoded English literals — a
 * separate i18n pass converts them to `ctx.i18next.t()`, out of scope here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitorDailyStats } from "~/database/schema";

namespace Heatmap {
	export interface Props {
		days: SelectMonitorDailyStats[];
	}
}

/**
 * Maps a day's success rate (0-100, or `null` for no data) to a cell background
 * color: `--ui-success-*` down through `--ui-warning-*` to `--ui-danger-*` as the
 * rate drops, `--ui-neutral-border` for no data. Each semantic family still shades
 * across two of its own tokens (e.g. `--ui-success-bg-solid` vs
 * `--ui-success-border-strong`) to preserve the original gradient's finer steps
 * within "success"/"failure" rather than collapsing every rate in a bucket to one
 * flat color.
 */
function getCellColor(successRate: number | null): string {
	if (successRate === null) return "var(--ui-neutral-border)";
	if (successRate === 100) return "var(--ui-success-bg-solid)";
	if (successRate >= 90) return "var(--ui-success-bg-solid-hover)";
	if (successRate >= 70) return "var(--ui-success-border-strong)";
	if (successRate >= 40) return "var(--ui-warning-bg-solid)";
	if (successRate >= 20) return "var(--ui-danger-border-strong)";
	return "var(--ui-danger-bg-solid)";
}

/** Renders the calendar-year heatmap grid for `days`, with Mon/Wed/Fri row labels, a date-range caption above it, and a color-scale legend below it. */
export default function Heatmap(handle: Handle<Heatmap.Props>) {
	return () => {
		let byDate = new Map(handle.props.days.map((day) => [day.date, day]));

		let year = new Date().getUTCFullYear();
		let start = new Date(Date.UTC(year, 0, 1));
		let end = new Date(Date.UTC(year, 11, 31));

		let dates: string[] = [];
		for (let d = start; d <= end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
			dates.push(d.toISOString().slice(0, 10));
		}

		let leadingBlanks = start.getUTCDay();
		let cells: Array<string | null> = [...Array(leadingBlanks).fill(null), ...dates];

		let weeks: Array<Array<string | null>> = [];
		for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

		return (
			<div>
				<div mix={css({ display: "flex", justifyContent: "space-between" })}>
					<span
						mix={css({
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
						})}
					>
						{start.toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
							timeZone: "UTC",
						})}
					</span>
					<span
						mix={css({
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
						})}
					>
						{end.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
					</span>
				</div>

				<div mix={css({ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0" })}>
					<div
						mix={css({
							display: "flex",
							flexDirection: "column",
							justifyContent: "space-between",
							gap: 4,
							paddingTop: 0,
						})}
					>
						{["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => (
							<span
								key={index}
								mix={css({
									height: 16,
									fontSize: "0.6875rem",
									fontWeight: 600,
									lineHeight: "16px",
									color: "var(--ui-neutral-fg-muted)",
								})}
							>
								{label}
							</span>
						))}
					</div>

					<div mix={css({ display: "flex", gap: 4 })}>
						{weeks.map((week, weekIndex) => (
							<div key={weekIndex} mix={css({ display: "flex", flexDirection: "column", gap: 4 })}>
								{week.map((date, dayIndex) => {
									if (date === null) {
										return <div key={dayIndex} mix={css({ width: 16, height: 16 })} />;
									}
									let day = byDate.get(date);
									let successRate =
										day && day.total_checks > 0
											? Math.round((day.successful_checks / day.total_checks) * 100)
											: null;
									return (
										<div
											key={dayIndex}
											title={
												day
													? `${date}: ${successRate}% success (${day.successful_checks}/${day.total_checks})`
													: date
											}
											mix={css({
												width: 16,
												height: 16,
												borderRadius: 2,
												background: getCellColor(successRate),
											})}
										/>
									);
								})}
							</div>
						))}
					</div>
				</div>

				<div
					mix={css({
						display: "flex",
						alignItems: "center",
						justifyContent: "flex-end",
						flexWrap: "wrap",
						gap: 12,
						marginTop: 4,
					})}
				>
					{[
						{ label: "Success", rates: [70, 90, 100] },
						{ label: "Mixed", rates: [50] },
						{ label: "Failure", rates: [10, 30] },
						{ label: "No data", rates: [null] },
					].map(({ label, rates }) => (
						<div key={label} mix={css({ display: "flex", alignItems: "center", gap: 4 })}>
							{rates.map((rate, index) => (
								<div
									key={index}
									mix={css({
										width: 16,
										height: 16,
										borderRadius: 2,
										background: getCellColor(rate),
									})}
								/>
							))}
							<span
								mix={css({
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
								})}
							>
								{label}
							</span>
						</div>
					))}
				</div>
			</div>
		);
	};
}
