/**
 * The opening `motionReduce` example: a spinner that stops when the reader asks their
 * system for reduced motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An animation stopped for a reduced-motion preference. */
export default {
	title: "Basic example",
	description:
		"Use `motionReduce(...)` to apply utilities when the reader asks for less motion, like stopping an animation. Turn on Reduce motion in your system's accessibility settings to stop the square:",
	render: () => (
		<div
			mix={[
				animation({
					keyframes: { to: { rotate: "1turn" } },
					duration: "1.5s",
					easing: "linear",
					iterationCount: "infinite",
				}),
				motionReduce(raw({ animationName: "none" })),
				is(16),
				bs(16),
				demo.box(),
			]}
		/>
	),
} satisfies UtilityExampleModule;
