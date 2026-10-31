/**
 * One HTTP monitor's page as a mockup: its uptime and p99 cards, the 90-day uptime bar
 * the status page also draws, and a day of response times by region. It shows what a
 * monitor records over time rather than a single check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

import { badgeVariant } from "~/resources/components/badge";
import {
	MockupWindow,
	PageTitle,
	Panel,
} from "~/resources/components/marketing/product-mockups/parts";
import { sampleDailyStats } from "~/resources/components/marketing/product-mockups/sample-data";
import StatCard from "~/resources/components/stat-card";
import UptimeBar from "~/resources/views/shared/uptime-bar";

/** A day of response times in milliseconds, one point an hour, per region drawn. */
const REGIONS = [
	{
		code: "FRA",
		color: "var(--ui-color-brand-600)",
		times: [
			142, 138, 151, 147, 139, 144, 162, 171, 158, 149, 153, 147, 141, 139, 152, 188, 214, 176, 158,
			149, 146, 143, 140, 138,
		],
	},
	{
		code: "IAD",
		color: "var(--ui-color-brand-300)",
		times: [
			96, 92, 101, 98, 94, 97, 108, 119, 112, 104, 99, 101, 95, 93, 102, 131, 152, 124, 108, 101,
			98, 96, 94, 92,
		],
	},
] as const;

/** The chart's drawing box and the latency its top edge stands for. */
const CHART = { width: 440, height: 96, max: 240 } as const;

/** Draws a monitor with three months of history and a day of response times. */
export default function MonitorMockup(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		return (
			<MockupWindow
				label={t("landing.mockups.monitor")}
				title={t("page.httpMonitors.header.title")}
				active="http"
			>
				<PageTitle
					title={t("page.monitor.header.title", { name: "Checkout API" })}
					detail="https://api.example.com/health"
					end={<Badge {...badgeVariant("up")}>{t("page.dashboard.table.status.up")}</Badge>}
				/>
				<div mix={[hstack({ gap: 3, align: "stretch" })]}>
					<StatCard label={t("page.monitor.stats.uptime.label")} value="99.95%" />
					<StatCard
						label={t("page.monitor.stats.p99ResponseTime.label")}
						value={t("page.monitor.stats.p99ResponseTime.value", { value: 214 })}
					/>
				</div>
				<Panel>
					<UptimeBar
						days={sampleDailyStats("checkout-api", { degraded: [61, 23], down: [40] })}
						labels={{
							daysAgo: t("statusPage.uptimeBar.daysAgo"),
							today: t("statusPage.uptimeBar.today"),
							legend: {
								full: t("statusPage.uptimeBar.legend.full"),
								partial: t("statusPage.uptimeBar.legend.partial"),
								down: t("statusPage.uptimeBar.legend.down"),
								noData: t("statusPage.uptimeBar.legend.noData"),
							},
						}}
						formatUptime={(percentage) => t("statusPage.uptimeBar.tooltip.uptime", { percentage })}
					/>
				</Panel>
				<Panel
					title={t("page.dashboard.table.columns.latencyChart")}
					end={
						<span mix={[hstack({ gap: 3, align: "center" }), text("xs"), fg("neutral")]}>
							{REGIONS.map((region) => (
								<span key={region.code} mix={[hstack({ gap: 1.5, align: "center" })]}>
									<span
										mix={[
											is("0.625rem"),
											bs("0.625rem"),
											raw({ borderRadius: "0.1875rem", backgroundColor: region.color }),
										]}
									/>
									{region.code}
								</span>
							))}
						</span>
					}
				>
					<LatencyChart />
				</Panel>
			</MockupWindow>
		);
	};
}

/** Each region's day of response times as a line over three quiet gridlines. */
function LatencyChart() {
	return () => {
		let step = CHART.width / (REGIONS[0].times.length - 1);
		let y = (value: number) => CHART.height - (value / CHART.max) * CHART.height;
		return (
			<div mix={[vstack({ gap: 1, align: "stretch" })]}>
				<svg
					viewBox={`0 0 ${CHART.width} ${CHART.height}`}
					mix={[is("100%"), raw({ display: "block", blockSize: "auto", overflow: "visible" })]}
				>
					{[0.25, 0.5, 0.75].map((line) => (
						<line
							key={line}
							x1="0"
							x2={CHART.width}
							y1={CHART.height * line}
							y2={CHART.height * line}
							stroke="var(--ui-marketing-hairline, var(--ui-neutral-border))"
							stroke-dasharray="3 5"
						/>
					))}
					{REGIONS.map((region) => (
						<polyline
							key={region.code}
							points={region.times
								.map((value, index) => `${(index * step).toFixed(1)},${y(value).toFixed(1)}`)
								.join(" ")}
							fill="none"
							stroke={region.color}
							stroke-width="2"
							stroke-linejoin="round"
							stroke-linecap="round"
						/>
					))}
				</svg>
				<span
					mix={[
						hstack({ gap: 2, align: "center", justify: "between" }),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					<span>00:00</span>
					<span>12:00</span>
					<span>23:00</span>
				</span>
			</div>
		);
	};
}
