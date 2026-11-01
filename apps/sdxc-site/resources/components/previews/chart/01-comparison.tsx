/**
 * Live example for a `Chart` read against its context: today's p95 latency over the same
 * hours last week, dashed and muted, an SLO threshold, and the incident that broke it shaded
 * as a band with its name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Chart } from "@sdxc/ui/app/chart";

/** Today's hourly p95 latency in milliseconds, 08:00 to 19:00. */
const TODAY = [182, 176, 190, 240, 342, 318, 214, 190, 185, 182, 179, 181];

/** The same hours last week. */
const LAST_WEEK = [170, 168, 174, 181, 186, 183, 177, 172, 171, 169, 168, 170];

/** Turns a day's readings into points, naming each for the marker a reader tabs to. */
function points(values: readonly number[], day: string) {
	return values.map((y, x) => ({ x, y, label: `${day} ${x + 8}:00, ${y} ms` }));
}

/** The source the page shows, matching the markup below. */
const CODE = `<Chart width={480} height={200} xDomain={[0, 11]} yDomain={[0, 400]} aria-label="p95 latency today against last week">
	<Chart.Band from={3.5} to={5.5} label="Incident #42" />
	<Chart.Line points={points(LAST_WEEK, "Last week")} comparison />
	<Chart.Line points={points(TODAY, "Today")} />
	<Chart.Threshold y={300} label="SLO 300 ms" tone="warning" />
</Chart>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Comparison, threshold and incident band",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("32rem")]}>
			<Chart
				width={480}
				height={200}
				xDomain={[0, 11]}
				yDomain={[0, 400]}
				aria-label="p95 latency today against last week"
			>
				<Chart.Band from={3.5} to={5.5} label="Incident #42" />
				<Chart.Line points={points(LAST_WEEK, "Last week")} comparison />
				<Chart.Line points={points(TODAY, "Today")} />
				<Chart.Threshold y={300} label="SLO 300 ms" tone="warning" />
			</Chart>
			<p mix={[text("sm"), fg("neutral.muted")]}>Solid: today. Dashed: the same hours last week.</p>
		</div>
	),
};
