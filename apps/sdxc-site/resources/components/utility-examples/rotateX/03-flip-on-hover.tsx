/**
 * A `rotateX` example that flips a tile on hover, the motion behind a split-flap
 * board or a card turning over top to bottom.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "sdxc/u/effects";
import { hover } from "sdxc/u/state";
import { perspective, rotateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A half turn around the horizontal axis on hover. */
export default {
	title: "Flipping on hover",
	description:
		'Combine it with `hover()` and a `transition("transform")` to flip an element over. Hover the tile to try it:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[hover(rotateX(180)), transition("transform", { duration: 500 }), demo.tile()]}>
					hover me
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
