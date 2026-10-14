/**
 * A `border` example setting the color alone, over a width set by a separate call, so a
 * reader sees the plain and strong border weights and a palette shade.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Border colors at a tone's two weights and from the palette. */
export default {
	title: "Border color",
	description:
		"Pass a string to set only the color: a bare tone like `brand` reads its subtle border weight, and `brand.strong` its strong one:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[border({ width: 2 }), border("brand"), demo.swatch()]}>border("brand")</div>
			<div mix={[border({ width: 2 }), border("brand.strong"), demo.swatch()]}>
				border("brand.strong")
			</div>
			<div mix={[border({ width: 2 }), border("danger.strong"), demo.swatch()]}>
				border("danger.strong")
			</div>
			<div mix={[border({ width: 2 }), border("color.warning.400"), demo.swatch()]}>
				border("color.warning.400")
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
