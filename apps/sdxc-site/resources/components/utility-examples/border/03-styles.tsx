/**
 * A `border` example across the border styles, each at the same width and color so the
 * style is the only difference.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Dashed, dotted and double borders. */
export default {
	title: "Border style",
	description: "Set `style` to draw a dashed, dotted or double border:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[border({ color: "brand.strong", width: 2, style: "dashed" }), demo.swatch()]}>
				dashed
			</div>
			<div mix={[border({ color: "brand.strong", width: 2, style: "dotted" }), demo.swatch()]}>
				dotted
			</div>
			<div mix={[border({ color: "brand.strong", width: 4, style: "double" }), demo.swatch()]}>
				double
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
