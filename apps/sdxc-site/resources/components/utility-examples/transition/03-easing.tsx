/**
 * A `transition` example with three easing curves over the same distance, so the reader
 * can hover each track and compare how the box accelerates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "sdxc/u/effects";
import { when } from "sdxc/u/state";
import { translateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One movement under three easing curves. */
export default {
	title: "Setting the easing",
	description:
		'Pass `easing` to choose the timing function, like `"linear"`, `"ease-in"` or a `cubic-bezier()`. Hover each track:',
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[demo.track()]}>
				<div
					mix={[
						transition("transform", { duration: 1000, easing: "linear" }),
						when(":hover > &", translateX("200%")),
						demo.tile(),
					]}
				>
					linear
				</div>
			</div>
			<div mix={[demo.track()]}>
				<div
					mix={[
						transition("transform", { duration: 1000, easing: "ease-in" }),
						when(":hover > &", translateX("200%")),
						demo.tile(),
					]}
				>
					ease-in
				</div>
			</div>
			<div mix={[demo.track()]}>
				<div
					mix={[
						transition("transform", {
							duration: 1000,
							easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
						}),
						when(":hover > &", translateX("200%")),
						demo.tile(),
					]}
				>
					overshoot
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
