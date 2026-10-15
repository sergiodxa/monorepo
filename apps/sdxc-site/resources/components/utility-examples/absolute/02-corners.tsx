/**
 * An `absolute` example with four boxes, one per corner, so a reader sees how each pair of
 * insets picks the edges an absolutely positioned element measures from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insBottom, insLeft, insRight, insTop, relative } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Four absolutely positioned boxes, each pinned to one corner by a pair of insets. */
export default {
	title: "Pinning to each corner",
	description:
		"Combine `absolute()` with a vertical and a horizontal inset to pin an element to any corner of its parent:",
	render: () => (
		<div mix={[relative(), is(96), bs(40), demo.track()]}>
			<div mix={[absolute(), insTop(0), insLeft(0), demo.block()]}>top left</div>
			<div mix={[absolute(), insTop(0), insRight(0), demo.block()]}>top right</div>
			<div mix={[absolute(), insBottom(0), insLeft(0), demo.block()]}>bottom left</div>
			<div mix={[absolute(), insBottom(0), insRight(0), demo.block()]}>bottom right</div>
		</div>
	),
} satisfies UtilityExampleModule;
