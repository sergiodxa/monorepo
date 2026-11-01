/**
 * Live example for a `Chart` whose series stops reporting: the hours no check ran are `null`,
 * so the line breaks there instead of dropping to zero, and a hatched band marks the stretch
 * as unknown where a shaded one would read as an incident.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Chart } from "@sdxc/ui/app/chart";

/** Hourly p95 latency in milliseconds, 08:00 to 19:00, `null` while the checker was down. */
const LATENCY = [182, 176, 190, 240, 268, null, null, null, 214, 190, 185, 181];

/** Turns the readings into points, naming each for the marker a reader tabs to. */
function points(values: readonly (number | null)[]) {
	return values.map((y, x) => ({
		x,
		y,
		label: y === null ? `${x + 8}:00, no data` : `${x + 8}:00, ${y} ms`,
	}));
}

/** The source the page shows, matching the markup below. */
const CODE = `<Chart width={480} height={200} xDomain={[0, 11]} yDomain={[0, 400]} aria-label="p95 latency today, with a gap in the checks">
	<Chart.Band from={4.5} to={7.5} label="No data" variant="hatched" />
	<Chart.Line points={points(LATENCY)} />
	<Chart.Threshold y={300} label="SLO 300 ms" tone="warning" />
</Chart>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Gaps with no data",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("32rem")]}>
			<Chart
				width={480}
				height={200}
				xDomain={[0, 11]}
				yDomain={[0, 400]}
				aria-label="p95 latency today, with a gap in the checks"
			>
				<Chart.Band from={4.5} to={7.5} label="No data" variant="hatched" />
				<Chart.Line points={points(LATENCY)} />
				<Chart.Threshold y={300} label="SLO 300 ms" tone="warning" />
			</Chart>
			<p mix={[text("sm"), fg("neutral.muted")]}>
				The line breaks where no check ran; the hatched band marks those hours as unknown.
			</p>
		</div>
	),
};
