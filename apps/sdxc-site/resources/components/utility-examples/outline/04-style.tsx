/**
 * An `outline` example with the outline styles, each at the same width and color so the
 * style is the only difference.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outline } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Dashed, dotted and double outlines. */
export default {
	title: "Style",
	description: "Set `style` in the object to draw a dashed, dotted or double outline:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[outline({ color: "brand", width: 2, style: "dashed", offset: 4 }), demo.block()]}>
				dashed
			</div>
			<div mix={[outline({ color: "brand", width: 2, style: "dotted", offset: 4 }), demo.block()]}>
				dotted
			</div>
			<div mix={[outline({ color: "brand", width: 4, style: "double", offset: 4 }), demo.block()]}>
				double
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
