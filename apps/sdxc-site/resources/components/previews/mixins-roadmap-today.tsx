/**
 * Live preview for `roadmapToday()`: a roadmap spanning two years, so today's line starts out
 * of view. Once the page hydrates, the roadmap scrolls so today sits a third of the way across.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Roadmap } from "@sdxc/ui/app/roadmap";

/** The source the page shows: `Roadmap` carries the mixin on its own today line. */
const CODE = `// Roadmap draws its today line with roadmapToday() on it, so a long range opens on today.
<Roadmap label="Roadmap" start="2026-01-01" end="2027-12-31" today="2026-11-12" labels={labels}>
	<Roadmap.Group title="2026">
		<Roadmap.Item name="Billing rewrite" start="2026-02-02" end="2026-06-26" progress={1} />
		<Roadmap.Item name="Checkout v2" start="2026-09-14" end="2026-12-11" progress={0.7} />
	</Roadmap.Group>
	<Roadmap.Group title="2027">
		<Roadmap.Item name="Design tokens" start="2027-01-11" end="2027-04-30" />
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

/** What the preview registry reads: the source to show, and the roadmap to draw. */
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
					"--ui-roadmap-list-width": "10rem",
				}),
			]}
		>
			<Roadmap
				label="Roadmap"
				start="2026-01-01"
				end="2027-12-31"
				today="2026-11-12"
				labels={LABELS}
				mix={[raw({ flex: "1 1 auto" })]}
			>
				<Roadmap.Group title="2026">
					<Roadmap.Item name="Billing rewrite" start="2026-02-02" end="2026-06-26" progress={1} />
					<Roadmap.Item name="Checkout v2" start="2026-09-14" end="2026-12-11" progress={0.7} />
				</Roadmap.Group>
				<Roadmap.Group title="2027">
					<Roadmap.Item name="Design tokens" start="2027-01-11" end="2027-04-30" />
				</Roadmap.Group>
			</Roadmap>
		</div>
	),
};
