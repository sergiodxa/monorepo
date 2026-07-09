/**
 * 365-day (calendar-year) uptime heatmap: one column per week, one cell per day,
 * colored by that day's `monitor_daily_stats.status`. Days with no data (not yet
 * reached, or the monitor didn't exist yet) render as empty cells. Weeks start on
 * Sunday, matching the OLD APP's calendar-year framing (`docs/analytics.md`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitorDailyStats } from "~/database/schema";

import * as s from "~/resources/styles";

namespace Heatmap {
	export interface Props {
		days: SelectMonitorDailyStats[];
	}
}

const CELL_MIX: Record<string, typeof s.heatmapCellUp> = {
	up: s.heatmapCellUp,
	degraded: s.heatmapCellDegraded,
	down: s.heatmapCellDown,
};

/** Builds Sunday-aligned week columns from Jan 1 of the current year through today. */
function buildWeeks(): Array<Array<string | null>> {
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

	return weeks;
}

export default function Heatmap(handle: Handle<Heatmap.Props>) {
	return () => {
		let byDate = new Map(handle.props.days.map((day) => [day.date, day]));
		let weeks = buildWeeks();

		return (
			<div mix={[s.heatmap]}>
				{weeks.map((week, weekIndex) => (
					<div key={weekIndex} mix={[s.heatmapWeek]}>
						{week.map((date, dayIndex) => {
							if (date === null) {
								return <div key={dayIndex} mix={[s.heatmapCell]} />;
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
									mix={[s.heatmapCell, statusMix ?? s.heatmapCellEmpty]}
								/>
							);
						})}
					</div>
				))}
			</div>
		);
	};
}
