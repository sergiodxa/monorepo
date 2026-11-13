/**
 * Live preview for `ganttToday()`: a Gantt chart spanning two years, so today's line starts out
 * of view. Once the page hydrates, the chart scrolls so today sits a third of the way across.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Gantt } from "@sdxc/ui/app/gantt";

/** The source the page shows: `Gantt` carries the mixin on its own today line. */
const CODE = `// Gantt draws its today line with ganttToday() on it, so a long range opens on today.
<Gantt label="Roadmap" start="2026-01-01" end="2027-12-31" today="2026-11-12" labels={labels}>
	<Gantt.Group title="2026">
		<Gantt.Item name="Billing rewrite" start="2026-02-02" end="2026-06-26" progress={1} />
		<Gantt.Item name="Checkout v2" start="2026-09-14" end="2026-12-11" progress={0.7} />
	</Gantt.Group>
	<Gantt.Group title="2027">
		<Gantt.Item name="Design tokens" start="2027-01-11" end="2027-04-30" />
	</Gantt.Group>
</Gantt>`;

/** The chart's strings. */
const LABELS: Gantt.Labels = {
	today: "Today",
	schedule: "{start} to {end}",
	progress: "{percent} complete",
	projected: "projected to finish {date}",
	unscheduled: "No dates yet",
};

/** What the preview registry reads: the source to show, and the chart to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "flex",
					inlineSize: "100%",
					blockSize: "14rem",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-lg)",
					overflow: "hidden",
					"--ui-gantt-list-width": "10rem",
				}),
			]}
		>
			<Gantt
				label="Roadmap"
				start="2026-01-01"
				end="2027-12-31"
				today="2026-11-12"
				labels={LABELS}
				mix={[raw({ flex: "1 1 auto" })]}
			>
				<Gantt.Group title="2026">
					<Gantt.Item name="Billing rewrite" start="2026-02-02" end="2026-06-26" progress={1} />
					<Gantt.Item name="Checkout v2" start="2026-09-14" end="2026-12-11" progress={0.7} />
				</Gantt.Group>
				<Gantt.Group title="2027">
					<Gantt.Item name="Design tokens" start="2027-01-11" end="2027-04-30" />
				</Gantt.Group>
			</Gantt>
		</div>
	),
};
