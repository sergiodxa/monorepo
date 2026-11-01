/**
 * Live example for `StatCard.Group` set as ruled columns: four numbers under a 1px rule
 * each, with no boxes, which reads calmer when the stats open a page rather than fill it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { StatCard } from "@sdxc/ui/app/stat-card";

/** One stat of the overview: its name, value and change from last week. */
const STATS = [
	{ label: "Checks run", value: "1.21M", delta: "+4.1%", trend: "up" },
	{ label: "Monitors down", value: "1", delta: "−2", trend: "down" },
	{ label: "Mean response", value: "143 ms", delta: "−9 ms", trend: "down" },
	{ label: "Alerts sent", value: "38", delta: "+11", trend: "up" },
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<StatCard.Group variant="ruled" aria-label="This week">
	{STATS.map((stat) => (
		<StatCard key={stat.label}>
			<StatCard.Label>{stat.label}</StatCard.Label>
			<StatCard.Value>{stat.value}</StatCard.Value>
			<StatCard.Delta
				trend={stat.trend}
				invert={stat.label !== "Checks run"}
				comparison="from last week"
			>
				{stat.delta}
			</StatCard.Delta>
		</StatCard>
	))}
</StatCard.Group>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Ruled columns",
	code: CODE,
	render: () => (
		<StatCard.Group variant="ruled" aria-label="This week">
			{STATS.map((stat) => (
				<StatCard key={stat.label}>
					<StatCard.Label>{stat.label}</StatCard.Label>
					<StatCard.Value>{stat.value}</StatCard.Value>
					<StatCard.Delta
						trend={stat.trend}
						invert={stat.label !== "Checks run"}
						comparison="from last week"
					>
						{stat.delta}
					</StatCard.Delta>
				</StatCard>
			))}
		</StatCard.Group>
	),
};
