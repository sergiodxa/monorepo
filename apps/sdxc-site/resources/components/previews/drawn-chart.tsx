/**
 * Live preview for `DrawnChart`: how often a feed reader really checks a feed, by how often
 * the feed posts, with the headline count ticking up and each band's bar growing in turn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { DrawnChart } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<DrawnChart
	aria-label="Median time between checks, by how often a feed posts"
	pauseLabel="Pause the animation"
	metric={{ value: 18240, suffix: " feeds", label: "Checked in the last hour" }}
	series={[
		{ label: "Posts several times an hour", value: 15, display: "15 min" },
		{ label: "Posts hourly", value: 30, display: "30 min" },
		{ label: "Posts a few times a day", value: 120, display: "2 h" },
		{ label: "Posts daily or less", value: 240, display: "4 h" },
	]}
	highlight={0}
	footnote="Median over the last 30 days"
/>`;

/** What the preview registry reads: the source to show, and the figure to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "32rem", marginInline: "auto" })]}>
			<DrawnChart
				aria-label="Median time between checks, by how often a feed posts"
				pauseLabel="Pause the animation"
				metric={{ value: 18240, suffix: " feeds", label: "Checked in the last hour" }}
				series={[
					{ label: "Posts several times an hour", value: 15, display: "15 min" },
					{ label: "Posts hourly", value: 30, display: "30 min" },
					{ label: "Posts a few times a day", value: 120, display: "2 h" },
					{ label: "Posts daily or less", value: 240, display: "4 h" },
				]}
				highlight={0}
				footnote="Median over the last 30 days"
			/>
		</div>
	),
};
