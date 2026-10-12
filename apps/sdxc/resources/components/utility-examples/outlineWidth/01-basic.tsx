/**
 * The opening `outlineWidth` example: one outline color and style at growing widths,
 * where a bare number is read as pixels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outlineColor, outlineStyle, outlineWidth } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Outlines one, two, four and eight pixels wide. */
export default {
	title: "Basic example",
	description: "Use `outlineWidth` with a number of pixels to set only the width of an outline:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[outlineStyle("solid"), outlineColor("brand"), outlineWidth(1), demo.block()]}>
				outlineWidth(1)
			</div>
			<div mix={[outlineStyle("solid"), outlineColor("brand"), outlineWidth(2), demo.block()]}>
				outlineWidth(2)
			</div>
			<div mix={[outlineStyle("solid"), outlineColor("brand"), outlineWidth(4), demo.block()]}>
				outlineWidth(4)
			</div>
			<div mix={[outlineStyle("solid"), outlineColor("brand"), outlineWidth(8), demo.block()]}>
				outlineWidth(8)
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
