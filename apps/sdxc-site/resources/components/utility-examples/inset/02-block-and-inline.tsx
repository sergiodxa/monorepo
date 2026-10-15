/**
 * An `inset` example with two values, offsetting the block axis and the inline axis apart
 * so the box sits closer to the top and bottom than to the sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, inset, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two values set the block offsets, then the inline offsets. */
export default {
	title: "Block and inline offsets",
	description:
		"Pass two values to offset the block axis and then the inline axis, like `inset(2, 12)`:",
	render: () => (
		<div mix={[relative(), is(64), bs(36), demo.track()]}>
			<div mix={[absolute(), inset(2, 12), demo.block()]}>inset(2, 12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
