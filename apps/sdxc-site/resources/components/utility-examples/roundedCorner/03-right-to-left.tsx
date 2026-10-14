/**
 * A `roundedCorner` example in a right-to-left context, so the reader sees a logical
 * corner follow the writing direction to the other side of the box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { roundedCorner } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same logical corner in a left-to-right and a right-to-left box. */
export default {
	title: "Following the writing direction",
	description:
		'Logical corners follow the writing direction, so `"start-start"` is the top right corner inside `dir="rtl"`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div dir="ltr" mix={[roundedCorner("start-start", "xl"), demo.shape()]}>
				ltr
			</div>
			<div dir="rtl" mix={[roundedCorner("start-start", "xl"), demo.shape()]}>
				rtl
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
