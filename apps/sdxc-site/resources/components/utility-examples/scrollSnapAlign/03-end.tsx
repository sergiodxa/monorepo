/**
 * A `scrollSnapAlign` example with `end`, so each card rests against the row's end
 * edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "@sdxc/u/layout";
import { scroll, scrollSnapAlign, scrollSnapType } from "@sdxc/u/overflow";
import { bs, is, maxIs, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Items that snap to the end of their container. */
export default {
	title: "Snapping to the end",
	description: 'Use `scrollSnapAlign("end")` to rest each child against the container\'s end edge:',
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
			<div mix={[scrollSnapAlign("end"), shrink(), is(56), bs(32), demo.block()]}>1</div>
			<div mix={[scrollSnapAlign("end"), shrink(), is(56), bs(32), demo.block()]}>2</div>
			<div mix={[scrollSnapAlign("end"), shrink(), is(56), bs(32), demo.block()]}>3</div>
			<div mix={[scrollSnapAlign("end"), shrink(), is(56), bs(32), demo.block()]}>4</div>
		</div>
	),
} satisfies UtilityExampleModule;
