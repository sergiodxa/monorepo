/**
 * An `overflow` example with an axis object, so the wide row scrolls along the inline
 * axis while the block axis stays clipped, set in one call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A different value per axis from one call. */
export default {
	title: "Setting each axis",
	description:
		'Pass an object to set only the axes it names, like `overflow({ inline: "auto", block: "hidden" })`. Prefer `inline` and `block` over `x` and `y` so the layout holds under right-to-left and vertical writing modes:',
	render: () => (
		<div
			mix={[
				overflow({ inline: "auto", block: "hidden" }),
				hstack({ gap: 4 }),
				is(96),
				maxIs("100%"),
				p(4),
				demo.track(),
			]}
		>
			<div mix={[shrink(), is(24), demo.block()]}>1</div>
			<div mix={[shrink(), is(24), demo.block()]}>2</div>
			<div mix={[shrink(), is(24), demo.block()]}>3</div>
			<div mix={[shrink(), is(24), demo.block()]}>4</div>
			<div mix={[shrink(), is(24), demo.block()]}>5</div>
		</div>
	),
} satisfies UtilityExampleModule;
