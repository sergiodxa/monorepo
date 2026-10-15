/**
 * The opening `overflowX` example: a row of items wider than its track, which scrolls
 * sideways, so a reader sees overflow set along the horizontal axis alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { overflowX } from "sdxc/u/overflow";
import { is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row that scrolls horizontally when its items do not fit. */
export default {
	title: "Basic example",
	description:
		'Use `overflowX("auto")` to let an element scroll horizontally when its content is wider than it is. Scroll the row sideways:',
	render: () => (
		<div mix={[overflowX("auto"), hstack({ gap: 4 }), is(96), maxIs("100%"), p(4), demo.track()]}>
			<div mix={[shrink(), is(24), demo.block()]}>1</div>
			<div mix={[shrink(), is(24), demo.block()]}>2</div>
			<div mix={[shrink(), is(24), demo.block()]}>3</div>
			<div mix={[shrink(), is(24), demo.block()]}>4</div>
			<div mix={[shrink(), is(24), demo.block()]}>5</div>
		</div>
	),
} satisfies UtilityExampleModule;
