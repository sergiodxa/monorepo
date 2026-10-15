/**
 * The opening `positionArea` example: four labels placed above, beside and below one
 * anchor, each by naming its side of the grid around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, anchorName, positionAnchor, positionArea } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A side keyword places the element on that side of its anchor, centred along it. */
export default {
	title: "Basic example",
	description:
		'Use `positionArea(side)` to place an anchor-positioned element on one side of its anchor, like `"top"` or `"right"`:',
	render: () => (
		<div mix={[m(18, 32)]}>
			<div mix={[anchorName("sides"), demo.block()]}>anchor</div>
			<div mix={[absolute(), positionAnchor("sides"), positionArea("top"), m(2), demo.block()]}>
				top
			</div>
			<div mix={[absolute(), positionAnchor("sides"), positionArea("right"), m(2), demo.block()]}>
				right
			</div>
			<div mix={[absolute(), positionAnchor("sides"), positionArea("bottom"), m(2), demo.block()]}>
				bottom
			</div>
			<div mix={[absolute(), positionAnchor("sides"), positionArea("left"), m(2), demo.block()]}>
				left
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
