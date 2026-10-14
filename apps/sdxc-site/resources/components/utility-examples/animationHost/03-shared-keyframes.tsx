/**
 * An `animationHost` example where one `@keyframes` rule, declared once on a parent,
 * runs on several children at different speeds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationHost, keyframes } from "@sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One keyframes rule run by three children at different durations. */
export default {
	title: "Sharing keyframes",
	description:
		"Declare the keyframes once and point several `animationHost()` calls at them, each with its own timing:",
	render: () => (
		<div
			mix={[
				keyframes("spin", { from: { rotate: "0deg" }, to: { rotate: "360deg" } }),
				demo.gallery(),
			]}
		>
			{["3s", "1.5s", "750ms"].map((duration) => (
				<div
					mix={[
						animationHost("spin", { duration, easing: "linear", iterationCount: "infinite" }),
						demo.tile(),
					]}
				>
					{duration}
				</div>
			))}
		</div>
	),
} satisfies UtilityExampleModule;
