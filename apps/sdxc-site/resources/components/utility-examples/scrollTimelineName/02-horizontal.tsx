/**
 * A `scrollTimelineName` example on a horizontal scroller, which needs its axis set
 * beside the name, so the timeline follows the inline scroll.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation, scrollTimelineName } from "sdxc/u/animation";
import { raw } from "sdxc/u/general";
import { hstack, insLeft, sticky } from "sdxc/u/layout";
import { scroll } from "sdxc/u/overflow";
import { is } from "sdxc/u/size";
import { z } from "sdxc/u/stacking";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tile spun by a horizontal scroll container's named timeline. */
export default {
	title: "Following the inline axis",
	description:
		"A scroll timeline follows the block axis; set `scroll-timeline-axis` beside the name to follow a horizontal scroller. Scroll the row sideways to spin the tile:",
	align: "stretch",
	render: () => (
		<div
			mix={[
				scrollTimelineName("row"),
				raw({ scrollTimelineAxis: "inline" }),
				scroll("x"),
				demo.panel(),
			]}
		>
			<div mix={[hstack({ gap: 4 }), is("max-content")]}>
				<div
					mix={[
						sticky(),
						insLeft(0),
						z(1),
						animation("turn", {
							keyframes: { from: { rotate: "0deg" }, to: { rotate: "360deg" } },
							duration: "auto",
							easing: "linear",
							timeline: "--row",
						}),
						demo.tile(),
					]}
				>
					scroll →
				</div>
				{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
					<div mix={[is(40), demo.card()]}>Item {n}</div>
				))}
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
