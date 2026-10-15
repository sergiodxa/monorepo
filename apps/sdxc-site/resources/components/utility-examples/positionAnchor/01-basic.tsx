/**
 * The opening `positionAnchor` example: a label tethered to the button that names
 * itself as its anchor, placed beside it by `positionArea`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, anchorName, positionAnchor, positionArea } from "sdxc/u/layout";
import { mis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A positioned element measures its placement from the anchor it names. */
export default {
	title: "Basic example",
	description:
		"Use `positionAnchor(name)` to tether a positioned element to the element that declares the same `anchorName(name)`:",
	render: () => (
		<div>
			<button type="button" mix={[anchorName("save"), demo.button()]}>
				Save
			</button>
			<div mix={[absolute(), positionAnchor("save"), positionArea("right"), mis(2), demo.block()]}>
				⌘S
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
