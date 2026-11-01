/**
 * Live example for `StatCard.Group` as the chart's tabs: each card links to the same page
 * with `?metric=`, the current one is underlined and marked `aria-current`, and the chart
 * below draws that metric, so the choice lives in the URL and works with no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { Chart } from "@sdxc/ui/app/chart";
import { StatCard } from "@sdxc/ui/app/stat-card";

/** Requests per hour over the last twelve hours, in thousands. */
const REQUESTS = [42, 40, 38, 37, 41, 48, 56, 61, 64, 63, 60, 58];

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 3, align: "stretch" })]}>
	<StatCard.Group variant="tabs" columns={3} aria-label="Metric shown in the chart">
		<StatCard href="/examples/dashboard?metric=requests" current>
			<StatCard.Label>Requests</StatCard.Label>
			<StatCard.Value>610k</StatCard.Value>
			<StatCard.Delta trend="up" comparison="vs yesterday">+8%</StatCard.Delta>
		</StatCard>
		<StatCard href="/examples/dashboard?metric=errors">
			<StatCard.Label>Errors</StatCard.Label>
			<StatCard.Value>2,431</StatCard.Value>
			<StatCard.Delta trend="up" invert comparison="vs yesterday">+14%</StatCard.Delta>
		</StatCard>
		<StatCard href="/examples/dashboard?metric=latency">
			<StatCard.Label>p95 latency</StatCard.Label>
			<StatCard.Value>182 ms</StatCard.Value>
			<StatCard.Delta trend="down" invert comparison="vs yesterday">−6 ms</StatCard.Delta>
		</StatCard>
	</StatCard.Group>
	<Chart width={480} height={140} xDomain={[0, 11]} yDomain={[0, 80]} aria-label="Requests per hour, last 12 hours">
		<Chart.Area points={requests} />
	</Chart>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Cards as the chart's tabs",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 3, align: "stretch" })]}>
			<StatCard.Group variant="tabs" columns={3} aria-label="Metric shown in the chart">
				<StatCard href="/examples/dashboard?metric=requests" current>
					<StatCard.Label>Requests</StatCard.Label>
					<StatCard.Value>610k</StatCard.Value>
					<StatCard.Delta trend="up" comparison="vs yesterday">
						+8%
					</StatCard.Delta>
				</StatCard>
				<StatCard href="/examples/dashboard?metric=errors">
					<StatCard.Label>Errors</StatCard.Label>
					<StatCard.Value>2,431</StatCard.Value>
					<StatCard.Delta trend="up" invert comparison="vs yesterday">
						+14%
					</StatCard.Delta>
				</StatCard>
				<StatCard href="/examples/dashboard?metric=latency">
					<StatCard.Label>p95 latency</StatCard.Label>
					<StatCard.Value>182 ms</StatCard.Value>
					<StatCard.Delta trend="down" invert comparison="vs yesterday">
						−6 ms
					</StatCard.Delta>
				</StatCard>
			</StatCard.Group>
			<Chart
				width={480}
				height={140}
				xDomain={[0, 11]}
				yDomain={[0, 80]}
				aria-label="Requests per hour, last 12 hours"
			>
				<Chart.Area
					points={REQUESTS.map((y, x) => ({ x, y, label: `${x + 1}h ago: ${y}k requests` }))}
				/>
			</Chart>
		</div>
	),
};
