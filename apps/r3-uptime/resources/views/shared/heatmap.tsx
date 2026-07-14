/**
 * Calendar-year uptime heatmap: one column per week, one cell per day, colored by
 * that day's `monitor_daily_stats.status`. Days with no data (not yet reached, or
 * the monitor didn't exist yet) render as empty cells. Weeks start on Sunday, from
 * January 1st of the current year through today (see `docs/analytics.md`). A date-range
 * caption sits above the grid and a status-color legend below it.
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

/** Small gray caption/legend text shared by the date-range row and the legend row. */
const caption = css({
	fontSize: "0.75rem",
	color: "oklch(0.55 0.01 145)",
	"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
});

/** Date-range caption row above the grid: start of year on the left, "Today" on the right. */
const rangeCaption = css({
	display: "flex",
	justifyContent: "space-between",
});

/** Horizontally-scrollable row of heatmap week-columns. */
const heatmap = css({
	display: "flex",
	gap: 3,
	overflowX: "auto",
	padding: "4px 0",
});

/** Legend row below the grid: one colored swatch + label per status, right-aligned. */
const legend = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 12,
	marginTop: 4,
});

/** One swatch + label pair within the legend row. */
const legendItem = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
});

/** Legend color swatch; combine with a status color mixin or `heatmapCellEmpty`. */
const legendSwatch = css({
	width: 10,
	height: 10,
	borderRadius: 2,
});

/** One week's column of day-cells in the heatmap. */
const heatmapWeek = css({
	display: "flex",
	flexDirection: "column",
	gap: 3,
});

/** One day-cell in the heatmap; combine with a status color mixin. */
const heatmapCell = css({
	width: 11,
	height: 11,
	borderRadius: 2,
});

/** Heatmap cell: no data for that day yet. */
const heatmapCellEmpty = css({
	background: "oklch(0.91 0.008 145)",
	"@media (prefers-color-scheme: dark)": { background: "oklch(0.42 0.008 145)" },
});

/**
 * Heatmap cell: fully up for that day. This and the degraded/down variants below
 * intentionally have no dark-mode override, so all three stay flat across color
 * schemes.
 */
const heatmapCellUp = css({
	background: "oklch(0.7 0.2 155)",
});

/** Heatmap cell: degraded for that day. */
const heatmapCellDegraded = css({
	background: "oklch(0.72 0.18 85)",
});

/** Heatmap cell: down for that day. */
const heatmapCellDown = css({
	background: "oklch(0.68 0.2 25)",
});

const CELL_MIX: Record<string, typeof heatmapCellUp> = {
	up: heatmapCellUp,
	degraded: heatmapCellDegraded,
	down: heatmapCellDown,
};

/** Sunday-aligned week columns from Jan 1 of the current year through today, plus that range's endpoints. */
interface WeekGrid {
	weeks: Array<Array<string | null>>;
	start: Date;
	end: Date;
}

/** Builds Sunday-aligned week columns from Jan 1 of the current year through today. */
function buildWeeks(): WeekGrid {
	let year = new Date().getUTCFullYear();
	let start = new Date(Date.UTC(year, 0, 1));
	let today = new Date();
	let end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

	let days: string[] = [];
	for (let d = start; d <= end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
		days.push(d.toISOString().slice(0, 10));
	}

	let leadingBlanks = start.getUTCDay();
	let cells: Array<string | null> = [...Array(leadingBlanks).fill(null), ...days];

	let weeks: Array<Array<string | null>> = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

	return { weeks, start, end };
}

/** Renders the calendar-year heatmap grid for `days`, using {@link buildWeeks} for the week layout, a date-range caption above it, and a status-color legend below it. */
export default function Heatmap(handle: Handle<Heatmap.Props>) {
	return () => {
		let byDate = new Map(handle.props.days.map((day) => [day.date, day]));
		let { weeks, start } = buildWeeks();

		return (
			<div>
				<div mix={[caption, rangeCaption]}>
					<span>{start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
					<span>Today</span>
				</div>

				<div mix={[heatmap]}>
					{weeks.map((week, weekIndex) => (
						<div key={weekIndex} mix={[heatmapWeek]}>
							{week.map((date, dayIndex) => {
								if (date === null) {
									return <div key={dayIndex} mix={[heatmapCell]} />;
								}
								let day = byDate.get(date);
								let statusMix = day ? CELL_MIX[day.status] : undefined;
								return (
									<div
										key={dayIndex}
										title={
											day
												? `${date}: ${day.status} (${day.successful_checks}/${day.total_checks})`
												: date
										}
										mix={[heatmapCell, statusMix ?? heatmapCellEmpty]}
									/>
								);
							})}
						</div>
					))}
				</div>

				<div mix={[legend]}>
					<div mix={[legendItem]}>
						<div mix={[legendSwatch, heatmapCellUp]} />
						<span mix={[caption]}>100%</span>
					</div>
					<div mix={[legendItem]}>
						<div mix={[legendSwatch, heatmapCellDegraded]} />
						<span mix={[caption]}>Partial</span>
					</div>
					<div mix={[legendItem]}>
						<div mix={[legendSwatch, heatmapCellDown]} />
						<span mix={[caption]}>Down</span>
					</div>
					<div mix={[legendItem]}>
						<div mix={[legendSwatch, heatmapCellEmpty]} />
						<span mix={[caption]}>No data</span>
					</div>
				</div>
			</div>
		);
	};
}
