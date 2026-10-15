/**
 * The opening `motionSafe` example: a spinner that turns only when the reader has not
 * asked for reduced motion, so the safe default is stillness.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation } from "@sdxc/u/animation";
import { motionSafe } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An animation that runs only without a reduced-motion preference. */
export default {
	title: "Basic example",
	description:
		"Use `motionSafe(...)` to apply animations and transitions only when the reader has not asked for less motion. Turn on Reduce motion in your system's accessibility settings to stop the square:",
	render: () => (
		<div
			mix={[
				motionSafe(
					animation({
						keyframes: { to: { rotate: "1turn" } },
						duration: "1.5s",
						easing: "linear",
						iterationCount: "infinite",
					}),
				),
				is(16),
				bs(16),
				demo.box(),
			]}
		/>
	),
} satisfies UtilityExampleModule;
