/**
 * A `scrollSnapStop` example with `normal`, so a fast swipe's momentum carries over
 * several cards before it rests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { scroll, scrollSnapAlign, scrollSnapStop, scrollSnapType } from "sdxc/u/overflow";
import { bs, is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Snap items that momentum may carry past. */
export default {
	title: "Letting momentum skip items",
	description:
		'Use `scrollSnapStop("normal")` to let a fast swipe carry past several items before snapping. Flick the row quickly and compare:',
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
			<div
				mix={[scrollSnapAlign(), scrollSnapStop("normal"), shrink(), is(56), bs(32), demo.block()]}
			>
				1
			</div>
			<div
				mix={[scrollSnapAlign(), scrollSnapStop("normal"), shrink(), is(56), bs(32), demo.block()]}
			>
				2
			</div>
			<div
				mix={[scrollSnapAlign(), scrollSnapStop("normal"), shrink(), is(56), bs(32), demo.block()]}
			>
				3
			</div>
			<div
				mix={[scrollSnapAlign(), scrollSnapStop("normal"), shrink(), is(56), bs(32), demo.block()]}
			>
				4
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
