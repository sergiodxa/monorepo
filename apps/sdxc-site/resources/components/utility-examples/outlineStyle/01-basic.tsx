/**
 * The opening `outlineStyle` example: one outline width and color in every common style,
 * so the style is the only difference.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outlineColor, outlineStyle, outlineWidth } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Solid, dashed, dotted and double outlines. */
export default {
	title: "Basic example",
	description: "Use `outlineStyle` to set only the style of an outline, like `dashed` or `dotted`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[outlineWidth(3), outlineColor("brand"), outlineStyle("solid"), demo.block()]}>
				solid
			</div>
			<div mix={[outlineWidth(3), outlineColor("brand"), outlineStyle("dashed"), demo.block()]}>
				dashed
			</div>
			<div mix={[outlineWidth(3), outlineColor("brand"), outlineStyle("dotted"), demo.block()]}>
				dotted
			</div>
			<div mix={[outlineWidth(4), outlineColor("brand"), outlineStyle("double"), demo.block()]}>
				double
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
