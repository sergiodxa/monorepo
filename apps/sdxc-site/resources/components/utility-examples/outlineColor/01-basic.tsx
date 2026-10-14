/**
 * The opening `outlineColor` example: outlines whose width and style come from other
 * calls, recolored by `outlineColor` alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outlineColor, outlineStyle, outlineWidth } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The default ring color beside two tones. */
export default {
	title: "Basic example",
	description:
		"Use `outlineColor` to set only the color of an outline, leaving its width and style to other calls:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[outlineWidth(2), outlineStyle("solid"), outlineColor(), demo.block()]}>
				outlineColor()
			</div>
			<div mix={[outlineWidth(2), outlineStyle("solid"), outlineColor("success"), demo.block()]}>
				outlineColor("success")
			</div>
			<div mix={[outlineWidth(2), outlineStyle("solid"), outlineColor("danger"), demo.block()]}>
				outlineColor("danger")
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
