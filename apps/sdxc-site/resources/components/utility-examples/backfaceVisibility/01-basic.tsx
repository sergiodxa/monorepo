/**
 * The opening `backfaceVisibility` example: two boxes turned to face away from the
 * reader, so the reader sees one show its mirrored back and the other disappear.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backfaceVisibility } from "@sdxc/u/effects";
import { perspective, rotateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A visible and a hidden back face on two turned boxes. */
export default {
	title: "Basic example",
	description:
		'Use `backfaceVisibility("hidden")` to hide an element once a 3D transform turns its back to the viewer, or `"visible"` to show it mirrored:',
	render: () => (
		<div mix={[perspective(600), demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[rotateY(150), backfaceVisibility("visible"), demo.tile()]}>visible</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotateY(150), backfaceVisibility("hidden"), demo.tile()]}>hidden</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
