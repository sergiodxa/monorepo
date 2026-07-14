/**
 * 90-day uptime heatmap for the public status page: a single row of thin vertical
 * bars for the last 90 days (today inclusive), one per day, colored by that day's
 * `monitor_daily_stats.status`. Days with no data (not yet reached, or the monitor
 * didn't exist yet) render as empty bars. A caption row sits above the bars —
 * "90 days ago" and "Today" at each end, the aggregate uptime percentage in the
 * middle, joined by connector lines — matching the common status-page pattern of
 * dense vertical bars rather than a calendar-style grid (that's the year-long
 * `Heatmap` component instead, used on the monitor detail page). The bars stretch
 * to fill the full row width (no per-bar max width), so the row never trails off
 * into empty space regardless of how many days actually have data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitorDailyStats } from "~/database/schema";

namespace MiniHeatmap {
	export interface Props {
		days: SelectMonitorDailyStats[];
	}
}

/** Small gray caption text shared by the range/uptime caption row and the legend row. */
const caption = css({
	fontSize: "0.75rem",
	color: "oklch(0.55 0.01 145)",
	whiteSpace: "nowrap",
	"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
});

/** Caption row above the row of bars: "90 days ago" — connector — "99.9% uptime" — connector — "Today". */
const rangeCaption = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	marginBottom: 6,
});

/** Thin horizontal line connecting the two ends of {@link rangeCaption} to the center label. */
const connector = css({
	flex: 1,
	height: 1,
	background: "oklch(0.87 0.01 145)",
	"@media (prefers-color-scheme: dark)": { background: "oklch(0.4 0.01 145)" },
});

/** Single flex row of the last 90 days' bars. */
const heatmapRow = css({
	display: "flex",
	alignItems: "stretch",
	gap: 2,
	height: 32,
});

/** Legend row below the row of bars: one colored swatch + label per status, right-aligned. */
const legend = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 12,
	marginTop: 6,
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

/**
 * One day-bar in the row; thin, tightly packed, and full-height — combine with a
 * status color mixin. No `maxWidth` cap: every bar shares `flex: 1` equally, so
 * the row of bars always stretches to fill the card's full width instead of
 * clumping to one side with empty space trailing off.
 */
const heatmapCell = css({
	flex: 1,
	minWidth: 2,
	borderRadius: 1,
});

/** Heatmap bar: no data for that day yet. */
const heatmapCellEmpty = css({
	background: "oklch(0.91 0.008 145)",
	"@media (prefers-color-scheme: dark)": { background: "oklch(0.42 0.008 145)" },
});

/**
 * Heatmap bar: fully up for that day. This and the degraded/down variants below
 * intentionally have no dark-mode override, so all three stay flat across color
 * schemes.
 */
const heatmapCellUp = css({
	background: "oklch(0.7 0.2 155)",
});

/** Heatmap bar: degraded for that day. */
const heatmapCellDegraded = css({
	background: "oklch(0.72 0.18 85)",
});

/** Heatmap bar: down for that day. */
const heatmapCellDown = css({
	background: "oklch(0.68 0.2 25)",
});

const CELL_MIX: Record<string, typeof heatmapCellUp> = {
	up: heatmapCellUp,
	degraded: heatmapCellDegraded,
	down: heatmapCellDown,
};

/** How many trailing days the row of bars covers. */
const DAYS = 90;

/** The last {@link DAYS} days (today inclusive) as `"YYYY-MM-DD"` strings, oldest first. */
function buildLastNDays(): string[] {
	let today = new Date();
	let end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

	let dates: string[] = [];
	for (let i = DAYS - 1; i >= 0; i--) {
		dates.push(new Date(end.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
	}
	return dates;
}

/**
 * Aggregate uptime across `days` as a formatted percentage, or `null` when
 * there's no data at all. `days` may cover more than {@link DAYS} (the caller
 * passes a full year's worth) — this only sums entries whose `date` falls in
 * `dates`, so the percentage matches the same window the bars render.
 */
function calculateUptimePercentage(
	days: SelectMonitorDailyStats[],
	dates: string[],
): string | null {
	let windowDates = new Set(dates);
	let totalChecks = 0;
	let successfulChecks = 0;

	for (let day of days) {
		if (!windowDates.has(day.date)) continue;
		totalChecks += day.total_checks;
		successfulChecks += day.successful_checks;
	}

	if (totalChecks === 0) return null;

	let percentage = (successfulChecks / totalChecks) * 100;
	return `${percentage.toFixed(percentage === 100 ? 0 : 2)}% uptime`;
}

/** Renders a single-row, last-90-days heatmap for `days`, as thin vertical bars with a range/uptime caption above and a status-color legend below. */
export default function MiniHeatmap(handle: Handle<MiniHeatmap.Props>) {
	return () => {
		let byDate = new Map(handle.props.days.map((day) => [day.date, day]));
		let dates = buildLastNDays();
		let uptime = calculateUptimePercentage(handle.props.days, dates);

		return (
			<div>
				<div mix={[rangeCaption]}>
					<span mix={[caption]}>90 days ago</span>
					<div mix={[connector]} />
					{uptime !== null && <span mix={[caption]}>{uptime}</span>}
					<div mix={[connector]} />
					<span mix={[caption]}>Today</span>
				</div>

				<div mix={[heatmapRow]}>
					{dates.map((date) => {
						let day = byDate.get(date);
						let statusMix = day ? CELL_MIX[day.status] : undefined;
						return (
							<div
								key={date}
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
