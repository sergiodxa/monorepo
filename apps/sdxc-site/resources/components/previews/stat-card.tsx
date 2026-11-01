/**
 * Live preview for `StatCard`: an ops dashboard's four numbers, each with a delta toned by
 * what it means for the service, the period it compares with, and a sentence explaining it.
 * The group drops from four columns to two and then one as its container narrows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Sparkline } from "@sdxc/ui/app/sparkline";
import { StatCard } from "@sdxc/ui/app/stat-card";

/** Hourly p95 latency over the last day, in milliseconds. */
const LATENCY = [164, 160, 158, 161, 166, 170, 175, 172, 169, 171, 178, 182];

/** The source the page shows, matching the markup below. */
const CODE = `<StatCard.Group aria-label="Last 7 days">
	<StatCard>
		<StatCard.Label>Uptime</StatCard.Label>
		<StatCard.Value>99.98%</StatCard.Value>
		<StatCard.Delta trend="up" trendLabel="Up" comparison="vs last week">+0.02%</StatCard.Delta>
		<StatCard.Footer>One 4-minute outage on Tuesday</StatCard.Footer>
	</StatCard>
	<StatCard>
		<StatCard.Label>p95 latency</StatCard.Label>
		<StatCard.Value>182 ms</StatCard.Value>
		<StatCard.Delta trend="up" invert trendLabel="Up" comparison="vs last week">+12 ms</StatCard.Delta>
		<StatCard.Chart>
			<Sparkline values={latency} label="p95 latency, rising over the last 12 hours" area tone="warning" />
		</StatCard.Chart>
		<StatCard.Footer>Slowest in eu-west since the 14:02 deploy</StatCard.Footer>
	</StatCard>
	<StatCard>
		<StatCard.Label>Error rate</StatCard.Label>
		<StatCard.Value>0.4%</StatCard.Value>
		<StatCard.Delta trend="down" invert trendLabel="Down" comparison="vs last week">−0.3%</StatCard.Delta>
		<StatCard.Footer>Mostly 502s from the billing API</StatCard.Footer>
	</StatCard>
	<StatCard>
		<StatCard.Label>Open incidents</StatCard.Label>
		<StatCard.Value>2</StatCard.Value>
		<StatCard.Delta trend="flat" trendLabel="No change" comparison="vs yesterday">0</StatCard.Delta>
		<StatCard.Footer>Both on checkout, oldest 3h 12m</StatCard.Footer>
	</StatCard>
</StatCard.Group>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<StatCard.Group aria-label="Last 7 days">
			<StatCard>
				<StatCard.Label>Uptime</StatCard.Label>
				<StatCard.Value>99.98%</StatCard.Value>
				<StatCard.Delta trend="up" trendLabel="Up" comparison="vs last week">
					+0.02%
				</StatCard.Delta>
				<StatCard.Footer>One 4-minute outage on Tuesday</StatCard.Footer>
			</StatCard>
			<StatCard>
				<StatCard.Label>p95 latency</StatCard.Label>
				<StatCard.Value>182 ms</StatCard.Value>
				<StatCard.Delta trend="up" invert trendLabel="Up" comparison="vs last week">
					+12 ms
				</StatCard.Delta>
				<StatCard.Chart>
					<Sparkline
						values={LATENCY}
						label="p95 latency, rising over the last 12 hours"
						area
						tone="warning"
					/>
				</StatCard.Chart>
				<StatCard.Footer>Slowest in eu-west since the 14:02 deploy</StatCard.Footer>
			</StatCard>
			<StatCard>
				<StatCard.Label>Error rate</StatCard.Label>
				<StatCard.Value>0.4%</StatCard.Value>
				<StatCard.Delta trend="down" invert trendLabel="Down" comparison="vs last week">
					−0.3%
				</StatCard.Delta>
				<StatCard.Footer>Mostly 502s from the billing API</StatCard.Footer>
			</StatCard>
			<StatCard>
				<StatCard.Label>Open incidents</StatCard.Label>
				<StatCard.Value>2</StatCard.Value>
				<StatCard.Delta trend="flat" trendLabel="No change" comparison="vs yesterday">
					0
				</StatCard.Delta>
				<StatCard.Footer>Both on checkout, oldest 3h 12m</StatCard.Footer>
			</StatCard>
		</StatCard.Group>
	),
};
