/**
 * A `borderEdge` example on a physical edge, a quote's accent that stays on the left in
 * every writing direction, beside a logical one that flips under right-to-left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { borderEdge } from "@sdxc/u/color";
import { pis } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A physical left edge and a logical inline-start edge, in a right-to-left block. */
export default {
	title: "Physical edges",
	description:
		"Name `left`, `right`, `top` or `bottom` to pin the border to that side whatever the writing direction; here the block is right-to-left:",
	render: () => (
		<div dir="rtl" mix={[demo.stack()]}>
			<p mix={[borderEdge("left", { color: "brand.strong", width: 4 }), pis(3), demo.prose()]}>
				left
			</p>
			<p
				mix={[
					borderEdge("inline-start", { color: "brand.strong", width: 4 }),
					pis(3),
					demo.prose(),
				]}
			>
				inline-start
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
