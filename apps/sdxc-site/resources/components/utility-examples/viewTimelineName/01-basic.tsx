/**
 * The opening `viewTimelineName` example: each card names its own visibility in the
 * scroll box, and the badge inside it slides in on that timeline as the card enters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation, viewTimelineName } from "@sdxc/u/animation";
import { hstack } from "@sdxc/u/layout";
import { scroll } from "@sdxc/u/overflow";
import { bs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Badges that slide in as their card enters the scroll box. */
export default {
	title: "Basic example",
	description:
		'Use `viewTimelineName()` on the element being watched, then animate it or a descendant on `timeline: "--name"`. Scroll the box to bring each card in:',
	align: "stretch",
	render: () => (
		<div mix={[scroll("y"), bs(64), demo.panel()]}>
			<div mix={[demo.stack()]}>
				{["One", "Two", "Three", "Four", "Five", "Six"].map((label) => (
					<div mix={[viewTimelineName("card"), hstack({ justify: "between" }), demo.card()]}>
						Card {label}
						<span
							mix={[
								animation("slide-in", {
									keyframes: {
										from: { opacity: 0, translate: "3rem 0" },
										to: { opacity: 1, translate: "0 0" },
									},
									duration: "auto",
									easing: "ease-out",
									fillMode: "both",
									timeline: "--card",
									range: "entry 25% cover 50%",
								}),
								demo.block(),
							]}
						>
							New
						</span>
					</div>
				))}
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
