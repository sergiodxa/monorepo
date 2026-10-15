/**
 * An `overflowX` example with `scroll`, so the horizontal scrollbar is drawn even
 * though the two items fit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { overflowX } from "sdxc/u/overflow";
import { is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A horizontal scrollbar drawn whether or not the row overflows. */
export default {
	title: "Scrolling always",
	description:
		'Use `overflowX("scroll")` to always show a horizontal scrollbar, where the operating system draws one, even when the content fits:',
	render: () => (
		<div mix={[overflowX("scroll"), hstack({ gap: 4 }), is(96), maxIs("100%"), p(4), demo.track()]}>
			<div mix={[shrink(), is(24), demo.block()]}>1</div>
			<div mix={[shrink(), is(24), demo.block()]}>2</div>
		</div>
	),
} satisfies UtilityExampleModule;
