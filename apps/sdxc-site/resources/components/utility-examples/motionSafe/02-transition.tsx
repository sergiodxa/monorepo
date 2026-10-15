/**
 * A `motionSafe` example on a hover transition, so the card still lifts for every
 * reader but glides there only for those who have not asked for less motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "@sdxc/u/effects";
import { motionSafe } from "@sdxc/u/responsive";
import { hover } from "@sdxc/u/state";
import { translateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A hover transition gated on the motion preference. */
export default {
	title: "Gating a transition",
	description:
		"Wrap a transition so the state change still happens for everyone but animates only for readers who have not asked for less motion. Hover the card, then try again with Reduce motion on:",
	render: () => (
		<div
			mix={[
				motionSafe(transition("transform", { duration: 300 })),
				hover(translateY(-2)),
				demo.block(),
			]}
		>
			Hover me
		</div>
	),
} satisfies UtilityExampleModule;
