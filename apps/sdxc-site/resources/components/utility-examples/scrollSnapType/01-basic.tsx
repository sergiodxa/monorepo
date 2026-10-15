/**
 * The opening `scrollSnapType` example: a row of cards that always comes to rest on
 * one, so a reader sees the container decide that scrolling snaps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { scroll, scrollSnapAlign, scrollSnapType } from "sdxc/u/overflow";
import { bs, is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A carousel that always rests on a card. */
export default {
	title: "Basic example",
	description:
		"Use `scrollSnapType()`, which applies `inline mandatory`, on a scroll container and `scrollSnapAlign()` on its children to make scrolling rest on a child. Scroll the row:",
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
			<div mix={[scrollSnapAlign(), shrink(), is(56), bs(32), demo.block()]}>1</div>
			<div mix={[scrollSnapAlign(), shrink(), is(56), bs(32), demo.block()]}>2</div>
			<div mix={[scrollSnapAlign(), shrink(), is(56), bs(32), demo.block()]}>3</div>
			<div mix={[scrollSnapAlign(), shrink(), is(56), bs(32), demo.block()]}>4</div>
		</div>
	),
} satisfies UtilityExampleModule;
