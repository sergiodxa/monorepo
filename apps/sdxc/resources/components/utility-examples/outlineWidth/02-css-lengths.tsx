/**
 * An `outlineWidth` example with CSS lengths and keywords, passed through unchanged, for
 * a width that scales with the text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outlineColor, outlineStyle, outlineWidth } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Outlines in `rem`, in `em` and with the `thick` keyword. */
export default {
	title: "CSS lengths",
	description: "Pass a string for any CSS length or keyword, like `0.25rem` or `thick`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[outlineStyle("solid"), outlineColor("brand"), outlineWidth("0.25rem"), demo.block()]}
			>
				0.25rem
			</div>
			<div
				mix={[outlineStyle("solid"), outlineColor("brand"), outlineWidth("0.5em"), demo.block()]}
			>
				0.5em
			</div>
			<div
				mix={[outlineStyle("solid"), outlineColor("brand"), outlineWidth("thick"), demo.block()]}
			>
				thick
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
