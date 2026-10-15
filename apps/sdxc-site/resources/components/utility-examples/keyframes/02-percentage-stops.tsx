/**
 * A `keyframes` example with percentage stops, which place each frame on the timeline
 * and give each stop its own easing, the shape of a bounce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationHost, keyframes } from "sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A bounce with stops placed by percentage, each with its own easing. */
export default {
	title: "Using percentage stops",
	description:
		'Key the frames by percentage, like `"50%"`, to place stops anywhere on the timeline; a stop may set its own easing:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div
				mix={[
					keyframes("bounce", {
						"0%, 100%": {
							translate: "0 -25%",
							animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)",
						},
						"50%": { translate: "0 0", animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)" },
					}),
					animationHost("bounce", { duration: "1s", iterationCount: "infinite" }),
					demo.tile(),
				]}
			>
				bounce
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
