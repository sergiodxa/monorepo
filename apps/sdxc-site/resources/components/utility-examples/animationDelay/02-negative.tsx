/**
 * An `animationDelay` example with negative delays, which start each tile already
 * partway through its spin, so a group is out of phase from the first frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationDelay, animationHost, keyframes } from "sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One spin started at three different points by negative delays. */
export default {
	title: "Using negative values",
	description:
		'A negative delay, like `animationDelay("-500ms")`, starts the animation at once, already advanced by that much of its duration:',
	render: () => (
		<div
			mix={[
				keyframes("spin", { from: { rotate: "0deg" }, to: { rotate: "360deg" } }),
				demo.gallery(),
			]}
		>
			{["0s", "-250ms", "-500ms"].map((delay) => (
				<div
					mix={[
						animationHost("spin", { duration: "2s", easing: "linear", iterationCount: "infinite" }),
						animationDelay(delay),
						demo.tile(),
					]}
				>
					{delay}
				</div>
			))}
		</div>
	),
} satisfies UtilityExampleModule;
