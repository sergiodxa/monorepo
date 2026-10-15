/**
 * A `transformStyle` example comparing `flat` with `preserve-3d` on the same turned card:
 * flattened, the faces are painted into one plane and the card shows the front mirrored.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backfaceVisibility } from "sdxc/u/effects";
import { zstack } from "sdxc/u/layout";
import { perspective, rotateY, transformStyle } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same half-turned card with its children flattened and kept in 3D. */
export default {
	title: "Flattening children",
	description:
		'Use `transformStyle("flat")` to paint the children into the parent\'s plane: turned around, the card shows its front mirrored instead of its back face:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.figure()]}>
				<div mix={[perspective(800), demo.track()]}>
					<div mix={[transformStyle("flat"), rotateY(180), zstack()]}>
						<div mix={[backfaceVisibility(), demo.tile()]}>Front</div>
						<div mix={[rotateY(180), backfaceVisibility(), demo.tile()]}>Back</div>
					</div>
				</div>
				<p mix={[demo.caption()]}>transformStyle("flat")</p>
			</div>
			<div mix={[demo.figure()]}>
				<div mix={[perspective(800), demo.track()]}>
					<div mix={[transformStyle(), rotateY(180), zstack()]}>
						<div mix={[backfaceVisibility(), demo.tile()]}>Front</div>
						<div mix={[rotateY(180), backfaceVisibility(), demo.tile()]}>Back</div>
					</div>
				</div>
				<p mix={[demo.caption()]}>transformStyle()</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
