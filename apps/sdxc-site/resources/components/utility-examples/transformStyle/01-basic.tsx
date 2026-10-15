/**
 * The opening `transformStyle` example: a flip card whose two faces live in one 3D space,
 * so turning the card on hover shows the back face. Hover the card to try it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backfaceVisibility, transition } from "sdxc/u/effects";
import { zstack } from "sdxc/u/layout";
import { hover } from "sdxc/u/state";
import { perspective, rotateY, transformStyle } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A flip card whose faces share the parent's 3D space. */
export default {
	title: "Basic example",
	description:
		"Use `transformStyle()` on the parent of 3D-transformed children so they keep their depth, like the two faces of a flip card. Hover the card to flip it:",
	render: () => (
		<div mix={[perspective(800), demo.track()]}>
			<div
				mix={[
					transformStyle(),
					hover(rotateY(180)),
					transition("transform", { duration: 600 }),
					zstack(),
				]}
			>
				<div mix={[backfaceVisibility(), demo.tile()]}>Front</div>
				<div mix={[rotateY(180), backfaceVisibility(), demo.tile()]}>Back</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
