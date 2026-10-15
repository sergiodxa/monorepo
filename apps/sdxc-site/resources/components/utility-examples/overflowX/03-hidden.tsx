/**
 * An `overflowX` example with its default `hidden`, so the items past the track's edge
 * are cut off and the row offers nothing to scroll.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { overflowX } from "sdxc/u/overflow";
import { is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row clipped at its inline edge. */
export default {
	title: "Clipping horizontally",
	description:
		"Call `overflowX()`, which applies `hidden`, to clip content that is wider than its element:",
	render: () => (
		<div mix={[overflowX(), hstack({ gap: 4 }), is(96), maxIs("100%"), p(4), demo.track()]}>
			<div mix={[shrink(), is(24), demo.block()]}>1</div>
			<div mix={[shrink(), is(24), demo.block()]}>2</div>
			<div mix={[shrink(), is(24), demo.block()]}>3</div>
			<div mix={[shrink(), is(24), demo.block()]}>4</div>
			<div mix={[shrink(), is(24), demo.block()]}>5</div>
		</div>
	),
} satisfies UtilityExampleModule;
