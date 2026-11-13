/**
 * Live preview for `Gantt`: four projects in two quarters on a month and week axis, one
 * finished, one late with its hatched tail, one planned, and today's line through them all.
 * The chart scrolls inside its own box, the names staying put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Gantt } from "@sdxc/ui/app/gantt";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<Gantt label="Roadmap" start="2026-09-01" end="2027-02-28" today="2026-11-12" labels={labels}>
	<Gantt.Group title="Q4 2026">
		<Gantt.Item name="Checkout v2" start="2026-09-14" end="2026-12-11" progress={0.7} />
		<Gantt.Item name="Search revamp" start="2026-09-07" end="2026-11-06" projectedEnd="2026-11-25" progress={0.85} />
	</Gantt.Group>
	<Gantt.Group title="Q1 2027">
		<Gantt.Item name="Design tokens" start="2026-12-07" end="2027-02-19" />
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

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "flex",
					inlineSize: "100%",
					blockSize: "16rem",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-lg)",
					overflow: "hidden",
					"--ui-gantt-list-width": "11rem",
				}),
			]}
		>
			<Gantt
				label="Roadmap"
				start="2026-09-01"
				end="2027-02-28"
				today="2026-11-12"
				labels={LABELS}
				mix={[raw({ flex: "1 1 auto" })]}
			>
				<Gantt.Group title="Q4 2026">
					<Gantt.Item name="Checkout v2" start="2026-09-14" end="2026-12-11" progress={0.7} />
					<Gantt.Item
						name="Search revamp"
						start="2026-09-07"
						end="2026-11-06"
						projectedEnd="2026-11-25"
						progress={0.85}
					/>
				</Gantt.Group>
				<Gantt.Group title="Q1 2027">
					<Gantt.Item name="Design tokens" start="2026-12-07" end="2027-02-19" />
					<Gantt.Item name="Edge cache" />
				</Gantt.Group>
			</Gantt>
		</div>
	),
};
