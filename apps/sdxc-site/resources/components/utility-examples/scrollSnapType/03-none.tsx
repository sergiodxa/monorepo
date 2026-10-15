/**
 * A `scrollSnapType` example with `none`, so the same row of snap items scrolls freely
 * and a reader compares it with a snapping one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "@sdxc/u/layout";
import { scroll, scrollSnapAlign, scrollSnapType } from "@sdxc/u/overflow";
import { bs, is, maxIs, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row that ignores its items' snap positions. */
export default {
	title: "Turning snapping off",
	description:
		'Use `scrollSnapType("none")` to turn snapping off, for example at a width where the carousel becomes a grid. Scroll the row and it stops wherever you leave it:',
	render: () => (
		<div
			mix={[
				scroll("x"),
				scrollSnapType("none"),
				hstack({ gap: 4 }),
				is(96),
				maxIs("100%"),
				p(4),
				demo.track(),
			]}
		>
			<div mix={[scrollSnapAlign(), shrink(), is(56), bs(32), demo.block()]}>1</div>
			<div mix={[scrollSnapAlign(), shrink(), is(56), bs(32), demo.block()]}>2</div>
			<div mix={[scrollSnapAlign(), shrink(), is(56), bs(32), demo.block()]}>3</div>
			<div mix={[scrollSnapAlign(), shrink(), is(56), bs(32), demo.block()]}>4</div>
		</div>
	),
} satisfies UtilityExampleModule;
