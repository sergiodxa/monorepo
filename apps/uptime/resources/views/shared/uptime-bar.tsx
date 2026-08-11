/**
 * Compact uptime bar: a single row of thin vertical bars covering the last
 * {@link UPTIME_WINDOW_DAYS} days (today inclusive), one bar per day, colored by that
 * day's `monitor_daily_stats.status`. A range/uptime caption sits above the row and a
 * status-color legend below it. Days with no data (not yet reached, or the monitor
 * didn't exist yet) render as empty bars, and the bars stretch to fill the full row
 * width (no per-bar max width), so the row never trails off into empty space
 * regardless of how many days actually have data.
 *
 * Shared because the public status page and every signed-in monitor detail page want
 * the same summary of the same table, and a second copy would be a second thing to keep
 * in step. Bar/legend colors read the shared `--ui-success/warning/danger/
 * neutral-*` design tokens instead of ad-hoc `oklch(...)` literals, so they follow the
 * app's light/dark theming automatically.
 *
 * The component holds no copy of its own: every caption and legend label arrives
 * pre-translated through {@link UptimeBar.Props.labels} and
 * {@link UptimeBar.Props.formatUptime}, built once per request by the caller from
 * `ctx.i18next.t("statusPage.uptimeBar.*")` so one card's worth of translation work is
 * shared across every bar on a page.
 *
 * At the 2px floor each bar carries, a full 90-day row needs ~358px; a caller whose
 * column can be narrower than that on a phone should give it a scroll box of its own.
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
 * Aggregate uptime across `days` as a formatted percentage value (no unit or
 * copy attached — pass it through {@link UptimeBar.Props.formatUptime} for the
 * translated caption), or `null` when there's no data at all. Only sums entries whose
 * `date` falls in `dates`, so a caller that hands over a wider window still gets a
 * percentage matching the bars actually rendered.
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

/** Renders the last-90-days bar row for `days`, with a range/uptime caption above it and a status-color legend below it. */
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
