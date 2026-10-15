/**
 * An `animation` example driven by scroll instead of time: each card fades in as it
 * enters the scroll box, through `timeline: "view()"` and a `range`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation } from "sdxc/u/animation";
import { scroll } from "sdxc/u/overflow";
import { bs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Cards that fade in as they scroll into view. */
export default {
	title: "Driving it with scroll",
	description:
		'Set `timeline: "view()"` to drive the animation by the element\'s position in its scroll container instead of time. Scroll the box to reveal each card:',
	align: "stretch",
	render: () => (
		<div mix={[scroll("y"), bs(64), demo.panel()]}>
			<div mix={[demo.stack()]}>
				{["One", "Two", "Three", "Four", "Five", "Six"].map((label) => (
					<div
						mix={[
							animation("reveal", {
								keyframes: {
									from: { opacity: 0, scale: "0.8" },
									to: { opacity: 1, scale: "1" },
								},
								duration: "auto",
								easing: "linear",
								fillMode: "both",
								timeline: "view()",
								range: "entry 0% entry 100%",
							}),
							demo.card(),
						]}
					>
						Card {label}
					</div>
				))}
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
