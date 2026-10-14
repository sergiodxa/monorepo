/**
 * An `animation` example that plays once after a delay and holds its first and last
 * frames with `fillMode: "both"`, the shape of an entrance animation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation } from "@sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An entrance that waits, plays once, and keeps its end state. */
export default {
	title: "Delaying and holding frames",
	description:
		'Set `delay` and `fillMode: "both"` for an entrance that stays hidden while it waits and keeps its final frame. Reload the frame to replay it:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div
				mix={[
					animation("enter", {
						keyframes: {
							from: { opacity: 0, translate: "0 2rem" },
							to: { opacity: 1, translate: "0 0" },
						},
						duration: "600ms",
						easing: "ease-out",
						delay: "500ms",
						fillMode: "both",
					}),
					demo.tile(),
				]}
			>
				enter
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
