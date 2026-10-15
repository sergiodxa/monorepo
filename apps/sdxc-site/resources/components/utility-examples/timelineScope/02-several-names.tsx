/**
 * A `timelineScope` example raising two names at once, so two bars outside their scroll
 * boxes each follow their own box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation, scrollTimelineName, timelineScope } from "sdxc/u/animation";
import { bg } from "sdxc/u/color";
import { gap, grid, gridTemplate } from "sdxc/u/layout";
import { scroll } from "sdxc/u/overflow";
import { bs } from "sdxc/u/size";
import { transformOrigin } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two bars outside two scrollers, each reaching its own scroller's timeline. */
export default {
	title: "Scoping several names",
	description:
		'Pass several names, like `timelineScope("left", "right")`, to raise more than one timeline. Scroll either box to fill its bar:',
	align: "stretch",
	render: () => (
		<div
			mix={[timelineScope("left", "right"), grid(), gridTemplate({ columns: "1fr 1fr" }), gap(3)]}
		>
			{["left", "right"].map((name) => (
				<div
					mix={[
						bs(2),
						bg("brand.solid"),
						transformOrigin("left"),
						animation(`progress-${name}`, {
							keyframes: { from: { scale: "0 1" }, to: { scale: "1 1" } },
							duration: "auto",
							easing: "linear",
							timeline: `--${name}`,
						}),
					]}
				/>
			))}
			{["left", "right"].map((name) => (
				<div mix={[scrollTimelineName(name), scroll("y"), bs(40), demo.panel()]}>
					<div mix={[demo.stack()]}>
						{[1, 2, 3, 4, 5, 6].map((n) => (
							<p mix={[demo.prose()]}>Paragraph {n}. Scroll this box to drive the timeline.</p>
						))}
					</div>
				</div>
			))}
		</div>
	),
} satisfies UtilityExampleModule;
