/**
 * Compact uptime bar: a row of thin bars covering the last
 * {@link UPTIME_WINDOW_DAYS} days, one per day, colored by that day's
 * `monitor_daily_stats.status`, with a range/uptime caption above and a
 * status legend below. Shared by the public status page and the monitor
 * detail page so both stay in step off one table. Captions and legend
 * labels arrive pre-translated through {@link UptimeBar.Props.labels} and
 * {@link UptimeBar.Props.formatUptime}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import { hstack } from "@pkg/u/layout";
import { bs, is, mbe, mbs, minIs } from "@pkg/u/size";
import { fontSize, nowrap } from "@pkg/u/typography";

import type { SelectMonitorDailyStats } from "~/database/schema";

import { UPTIME_WINDOW_DAYS } from "~/app/data/monitor-daily-stats";

/** The last {@link UPTIME_WINDOW_DAYS} days (today inclusive) as `"YYYY-MM-DD"` strings, oldest first. */
function buildLastNDays(): string[] {
	let today = new Date();
	let end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

	let dates: string[] = [];
	for (let i = UPTIME_WINDOW_DAYS - 1; i >= 0; i--) {
		dates.push(new Date(end.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
	}
	return dates;
}

/**
 * Aggregate uptime across `days` as a formatted percentage string (no unit or
 * copy attached; pass it through {@link UptimeBar.Props.formatUptime}), or
 * `null` when there's no data — filtered by `dates` so a wider `days` window still matches the rendered bars.
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
	return percentage.toFixed(percentage === 100 ? 0 : 2);
}

namespace UptimeBar {
	export interface Props {
		days: SelectMonitorDailyStats[];
		/** Pre-translated captions and legend labels, shared across every bar on a page. */
		labels: {
			daysAgo: string;
			today: string;
			legend: {
				full: string;
				partial: string;
				down: string;
				noData: string;
			};
		};
		/** Formats a {@link calculateUptimePercentage} result into the translated "X% uptime" caption. */
		formatUptime: (percentage: string) => string;
	}
}

/**
 * Renders the last-{@link UPTIME_WINDOW_DAYS}-days bar row for `days`, with a
 * range/uptime caption above it and a status-color legend below it. At the 2px
 * floor each bar carries, the row needs ~358px; give it a scroll box on narrower columns.
 */
export default function UptimeBar(handle: Handle<UptimeBar.Props>) {
	return () => {
		let { labels, formatUptime } = handle.props;
		let byDate = new Map(handle.props.days.map((day) => [day.date, day]));
		let dates = buildLastNDays();
		let uptime = calculateUptimePercentage(handle.props.days, dates);

		return (
			<div>
				<div mix={[hstack({ align: "center", gap: "8px" }), mbe("6px")]}>
					<span mix={[fontSize("0.75rem"), fg("neutral.muted"), nowrap()]}>{labels.daysAgo}</span>
					<div mix={[raw({ flex: "1" }), bs("1px"), bg("neutral.border")]} />
					{uptime !== null && (
						<span mix={[fontSize("0.75rem"), fg("neutral.muted"), nowrap()]}>
							{formatUptime(uptime)}
						</span>
					)}
					<div mix={[raw({ flex: "1" }), bs("1px"), bg("neutral.border")]} />
					<span mix={[fontSize("0.75rem"), fg("neutral.muted"), nowrap()]}>{labels.today}</span>
				</div>

				<div mix={[hstack({ align: "stretch", gap: "2px" }), bs("32px")]}>
					{dates.map((date) => {
						let day = byDate.get(date);
						return (
							<div
								key={date}
								title={
									day
										? `${date}: ${day.status} (${day.successful_checks}/${day.total_checks})`
										: date
								}
								mix={[
									raw({ flex: "1" }),
									minIs("2px"),
									rounded("1px"),
									day?.status === "up"
										? bg("success.solid")
										: day?.status === "degraded"
											? bg("warning.solid")
											: day?.status === "down"
												? bg("danger.solid")
												: bg("neutral.border"),
								]}
							/>
						);
					})}
				</div>

				<div mix={[hstack({ align: "center", justify: "end", gap: "12px" }), mbs("6px")]}>
					<div mix={[hstack({ align: "center", gap: "4px" })]}>
						<div mix={[is("10px"), bs("10px"), rounded("2px"), bg("success.solid")]} />
						<span mix={[fontSize("0.75rem"), fg("neutral.muted"), nowrap()]}>
							{labels.legend.full}
						</span>
					</div>
					<div mix={[hstack({ align: "center", gap: "4px" })]}>
						<div mix={[is("10px"), bs("10px"), rounded("2px"), bg("warning.solid")]} />
						<span mix={[fontSize("0.75rem"), fg("neutral.muted"), nowrap()]}>
							{labels.legend.partial}
						</span>
					</div>
					<div mix={[hstack({ align: "center", gap: "4px" })]}>
						<div mix={[is("10px"), bs("10px"), rounded("2px"), bg("danger.solid")]} />
						<span mix={[fontSize("0.75rem"), fg("neutral.muted"), nowrap()]}>
							{labels.legend.down}
						</span>
					</div>
					<div mix={[hstack({ align: "center", gap: "4px" })]}>
						<div mix={[is("10px"), bs("10px"), rounded("2px"), bg("neutral.border")]} />
						<span mix={[fontSize("0.75rem"), fg("neutral.muted"), nowrap()]}>
							{labels.legend.noData}
						</span>
					</div>
				</div>
			</div>
		);
	};
}
