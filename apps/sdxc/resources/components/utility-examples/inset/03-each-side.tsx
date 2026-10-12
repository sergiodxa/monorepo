/**
 * An `inset` example with four values, one per side in block-start, inline-end,
 * block-end, inline-start order, so each edge sits its own distance away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, inset, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Four values set each side, clockwise from the block start. */
export default {
	title: "Setting each side",
	description:
		"Pass four values to offset block-start, inline-end, block-end and inline-start in that order:",
	render: () => (
		<div mix={[relative(), is(80), bs(36), demo.track()]}>
			<div mix={[absolute(), inset(2, 4, 12, 16), demo.block()]}>inset(2, 4, 12, 16)</div>
		</div>
	),
} satisfies UtilityExampleModule;
