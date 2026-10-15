/**
 * A `scrollSnapType` example on the block axis with `proximity`, so the list snaps only
 * when a scroll ends near an item and otherwise stays where it stopped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { shrink, vstack } from "sdxc/u/layout";
import { scroll, scrollSnapAlign, scrollSnapType } from "sdxc/u/overflow";
import { bs, is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A vertical list that snaps only near an item. */
export default {
	title: "Snapping by proximity",
	description:
		'Use `scrollSnapType("block", "proximity")` to snap vertically, and only when a scroll ends close to a snap position:',
	render: () => (
		<div
			mix={[
				scroll("y"),
				scrollSnapType("block", "proximity"),
				vstack({ gap: 4 }),
				bs(64),
				is(72),
				maxIs("100%"),
				p(4),
				demo.track(),
			]}
		>
			<div mix={[scrollSnapAlign(), shrink(), bs(32), demo.block()]}>1</div>
			<div mix={[scrollSnapAlign(), shrink(), bs(32), demo.block()]}>2</div>
			<div mix={[scrollSnapAlign(), shrink(), bs(32), demo.block()]}>3</div>
			<div mix={[scrollSnapAlign(), shrink(), bs(32), demo.block()]}>4</div>
			<div mix={[scrollSnapAlign(), shrink(), bs(32), demo.block()]}>5</div>
			<div mix={[scrollSnapAlign(), shrink(), bs(32), demo.block()]}>6</div>
		</div>
	),
} satisfies UtilityExampleModule;
