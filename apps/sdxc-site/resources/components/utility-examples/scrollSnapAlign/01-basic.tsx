/**
 * The opening `scrollSnapAlign` example: cards that snap to the centre of their row,
 * the shape of a centred carousel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { scroll, scrollSnapAlign, scrollSnapType } from "sdxc/u/overflow";
import { bs, is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Items that snap to the centre of their container. */
export default {
	title: "Basic example",
	description:
		'Use `scrollSnapAlign("center")` on the children of a snapping container to rest each one in its centre. Scroll the row:',
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
			<div mix={[scrollSnapAlign("center"), shrink(), is(56), bs(32), demo.block()]}>1</div>
			<div mix={[scrollSnapAlign("center"), shrink(), is(56), bs(32), demo.block()]}>2</div>
			<div mix={[scrollSnapAlign("center"), shrink(), is(56), bs(32), demo.block()]}>3</div>
			<div mix={[scrollSnapAlign("center"), shrink(), is(56), bs(32), demo.block()]}>4</div>
		</div>
	),
} satisfies UtilityExampleModule;
