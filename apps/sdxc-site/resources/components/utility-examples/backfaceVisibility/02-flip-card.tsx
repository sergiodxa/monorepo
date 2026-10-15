/**
 * A `backfaceVisibility` example building a flip card, the effect the utility exists
 * for: each face hides its back, so only the side facing the reader shows as it turns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backfaceVisibility, transition } from "sdxc/u/effects";
import { zstack } from "sdxc/u/layout";
import { when } from "sdxc/u/state";
import { perspective, rotateY, transformStyle } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card that flips to its back face on hover. */
export default {
	title: "Building a flip card",
	description:
		"Hide the back face of both sides of a card and turn the card around on hover. Hover the card:",
	render: () => (
		<div mix={[perspective(800)]}>
			<div
				mix={[
					zstack(),
					transformStyle(),
					transition("transform", { duration: 600 }),
					when(":hover > &", rotateY(180)),
				]}
			>
				<div mix={[backfaceVisibility(), demo.tile()]}>Front</div>
				<div mix={[backfaceVisibility(), rotateY(180), demo.tile()]}>Back</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
