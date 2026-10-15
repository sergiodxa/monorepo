/**
 * A `motionReduce` example that drops a hover transition for readers who asked for less
 * motion, keeping the state change itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition, transitionProperty } from "@sdxc/u/effects";
import { motionReduce } from "@sdxc/u/responsive";
import { hover } from "@sdxc/u/state";
import { translateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A transition removed for a reduced-motion preference. */
export default {
	title: "Removing a transition",
	description:
		'Remove a transition with `motionReduce(transitionProperty("none"))`, so the change still happens without the animation. Hover the card, then try again with Reduce motion on:',
	render: () => (
		<div
			mix={[
				transition("transform", { duration: 300 }),
				motionReduce(transitionProperty("none")),
				hover(translateY(-2)),
				demo.block(),
			]}
		>
			Hover me
		</div>
	),
} satisfies UtilityExampleModule;
