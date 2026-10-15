/**
 * A `positionArea` example with two keywords, one per axis, which place four labels in
 * the four corner cells around one anchor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, anchorName, positionAnchor, positionArea } from "sdxc/u/layout";
import { m } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A keyword per axis picks one corner cell of the grid around the anchor. */
export default {
	title: "Placing in a corner",
	description:
		'Pass a keyword for each axis, like `"top left"`, to place the element in a corner cell around its anchor:',
	render: () => (
		<div mix={[m(20, 40)]}>
			<div mix={[anchorName("corners"), demo.block()]}>anchor</div>
			<div mix={[absolute(), positionAnchor("corners"), positionArea("top left"), demo.block()]}>
				top left
			</div>
			<div mix={[absolute(), positionAnchor("corners"), positionArea("top right"), demo.block()]}>
				top right
			</div>
			<div mix={[absolute(), positionAnchor("corners"), positionArea("bottom left"), demo.block()]}>
				bottom left
			</div>
			<div
				mix={[absolute(), positionAnchor("corners"), positionArea("bottom right"), demo.block()]}
			>
				bottom right
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
