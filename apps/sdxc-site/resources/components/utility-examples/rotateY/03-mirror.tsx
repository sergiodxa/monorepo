/**
 * A `rotateY` example turning a tile by half a revolution, which shows its back face:
 * the label reads mirrored, the effect a flip card hides with `backfaceVisibility()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backfaceVisibility } from "@sdxc/u/effects";
import { perspective, rotateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A half turn that shows the element's back face, and the same turn with it hidden. */
export default {
	title: "Showing the back face",
	description:
		"A `rotateY(180)` turns the element to show its mirrored back; add `backfaceVisibility()` to hide it, as a flip card does:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateY(180), demo.tile()]}>rotateY(180)</div>
			</div>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateY(180), backfaceVisibility(), demo.tile()]}>hidden</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
