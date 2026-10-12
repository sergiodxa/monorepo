/**
 * The opening `scrollSnapStop` example: cards that a fast swipe cannot skip past, so
 * one flick advances exactly one card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "@sdxc/u/layout";
import { scroll, scrollSnapAlign, scrollSnapStop, scrollSnapType } from "@sdxc/u/overflow";
import { bs, is, maxIs, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Snap items that a fast swipe must stop on. */
export default {
	title: "Basic example",
	description:
		"Use `scrollSnapStop()`, which applies `always`, on snap items so a fast swipe stops on the next one instead of flying past it. Flick the row quickly with a trackpad or touch:",
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
			<div mix={[scrollSnapAlign(), scrollSnapStop(), shrink(), is(56), bs(32), demo.block()]}>
				1
			</div>
			<div mix={[scrollSnapAlign(), scrollSnapStop(), shrink(), is(56), bs(32), demo.block()]}>
				2
			</div>
			<div mix={[scrollSnapAlign(), scrollSnapStop(), shrink(), is(56), bs(32), demo.block()]}>
				3
			</div>
			<div mix={[scrollSnapAlign(), scrollSnapStop(), shrink(), is(56), bs(32), demo.block()]}>
				4
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
