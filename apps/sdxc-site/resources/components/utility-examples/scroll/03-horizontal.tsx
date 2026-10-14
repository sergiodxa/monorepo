/**
 * A `scroll` example limited to the horizontal axis, the shape of a row of cards or a
 * wide table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "@sdxc/u/layout";
import { scroll } from "@sdxc/u/overflow";
import { is, maxIs, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scroll container along the horizontal axis only. */
export default {
	title: "Scrolling horizontally",
	description:
		'Pass `"x"` to scroll only horizontally, like a row of cards. Scroll the row sideways:',
	render: () => (
		<div mix={[scroll("x"), hstack({ gap: 4 }), is(96), maxIs("100%"), p(4), demo.track()]}>
			<div mix={[shrink(), is(24), demo.block()]}>1</div>
			<div mix={[shrink(), is(24), demo.block()]}>2</div>
			<div mix={[shrink(), is(24), demo.block()]}>3</div>
			<div mix={[shrink(), is(24), demo.block()]}>4</div>
			<div mix={[shrink(), is(24), demo.block()]}>5</div>
		</div>
	),
} satisfies UtilityExampleModule;
