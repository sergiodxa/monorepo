/**
 * Live preview for `Roadmap`: four projects in two quarters on a month and week axis, one
 * finished, one late with its hatched tail, one planned, and today's line through them all.
 * The roadmap scrolls inside its own box, the names staying put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Roadmap } from "@sdxc/ui/app/roadmap";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<Roadmap label="Roadmap" start="2026-09-01" end="2027-02-28" today="2026-11-12" labels={labels}>
	<Roadmap.Group title="Q4 2026">
		<Roadmap.Item name="Checkout v2" start="2026-09-14" end="2026-12-11" progress={0.7} />
		<Roadmap.Item name="Search revamp" start="2026-09-07" end="2026-11-06" projectedEnd="2026-11-25" progress={0.85} />
	</Roadmap.Group>
	<Roadmap.Group title="Q1 2027">
		<Roadmap.Item name="Design tokens" start="2026-12-07" end="2027-02-19" />
	</Roadmap.Group>
</Roadmap>`;

/** The roadmap's strings. */
const LABELS: Roadmap.Labels = {
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
					"--ui-roadmap-list-width": "11rem",
				}),
			]}
		>
			<Roadmap
				label="Roadmap"
				start="2026-09-01"
				end="2027-02-28"
				today="2026-11-12"
				labels={LABELS}
				mix={[raw({ flex: "1 1 auto" })]}
			>
				<Roadmap.Group title="Q4 2026">
					<Roadmap.Item name="Checkout v2" start="2026-09-14" end="2026-12-11" progress={0.7} />
					<Roadmap.Item
						name="Search revamp"
						start="2026-09-07"
						end="2026-11-06"
						projectedEnd="2026-11-25"
						progress={0.85}
					/>
				</Roadmap.Group>
				<Roadmap.Group title="Q1 2027">
					<Roadmap.Item name="Design tokens" start="2026-12-07" end="2027-02-19" />
					<Roadmap.Item name="Edge cache" />
				</Roadmap.Group>
			</Roadmap>
		</div>
	),
};
