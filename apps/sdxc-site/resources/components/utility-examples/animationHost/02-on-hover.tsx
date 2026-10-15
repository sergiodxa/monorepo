/**
 * An `animationHost` example run only while the element is hovered, since a state
 * wrapper can hold the host declarations while the keyframes stay at the top level.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationHost, keyframes } from "@sdxc/u/animation";
import { hover } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A wiggle that runs while the tile is hovered. */
export default {
	title: "Running in a state",
	description:
		"Wrap it in a state like `hover()` to run the animation only while that state holds. Hover the tile to try it:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div
				mix={[
					keyframes("wiggle", {
						"0%, 100%": { rotate: "-6deg" },
						"50%": { rotate: "6deg" },
					}),
					hover(animationHost("wiggle", { duration: "300ms", iterationCount: "infinite" })),
					demo.tile(),
				]}
			>
				hover me
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
