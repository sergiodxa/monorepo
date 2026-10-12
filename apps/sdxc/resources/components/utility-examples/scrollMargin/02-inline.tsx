/**
 * A `scrollMargin` example with two values on the items of a snapping row, so each card
 * snaps a little in from the row's start edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "@sdxc/u/layout";
import { scroll, scrollMargin, scrollSnapAlign, scrollSnapType } from "@sdxc/u/overflow";
import { bs, is, maxIs, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Snap items that settle inset along the inline axis. */
export default {
	title: "Insetting snapped items",
	description:
		"Pass a block and an inline value, like `scrollMargin(0, 8)`, to grow the area each item snaps by. Scroll the row and each card settles away from the edge:",
	render: () => (
		<div
			mix={[
				scroll("x"),
				scrollSnapType(),
				hstack({ gap: 4 }),
				is(96),
				maxIs("100%"),
				p(4),
				demo.track(),
			]}
		>
			<div mix={[scrollSnapAlign(), scrollMargin(0, 8), shrink(), is(56), bs(32), demo.block()]}>
				1
			</div>
			<div mix={[scrollSnapAlign(), scrollMargin(0, 8), shrink(), is(56), bs(32), demo.block()]}>
				2
			</div>
			<div mix={[scrollSnapAlign(), scrollMargin(0, 8), shrink(), is(56), bs(32), demo.block()]}>
				3
			</div>
			<div mix={[scrollSnapAlign(), scrollMargin(0, 8), shrink(), is(56), bs(32), demo.block()]}>
				4
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
