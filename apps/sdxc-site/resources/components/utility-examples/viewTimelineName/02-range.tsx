/**
 * A `viewTimelineName` example with an `exit` range, which runs the animation only while
 * the watched card leaves the box, so it fades as it scrolls out of view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation, viewTimelineName } from "@sdxc/u/animation";
import { scroll } from "@sdxc/u/overflow";
import { bs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Cards that fade out while they leave the scroll box. */
export default {
	title: "Picking a range",
	description:
		'Set `range` to run only part of the timeline, like `"exit"` while the watched element leaves the scroll box. Scroll down to fade each card out:',
	align: "stretch",
	render: () => (
		<div mix={[scroll("y"), bs(64), demo.panel()]}>
			<div mix={[demo.stack()]}>
				{["One", "Two", "Three", "Four", "Five", "Six"].map((label) => (
					<div mix={[viewTimelineName("card"), demo.card()]}>
						<p
							mix={[
								animation("fade-out", {
									keyframes: { from: { opacity: 1 }, to: { opacity: 0 } },
									duration: "auto",
									easing: "linear",
									fillMode: "both",
									timeline: "--card",
									range: "exit",
								}),
							]}
						>
							Card {label}
						</p>
					</div>
				))}
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
