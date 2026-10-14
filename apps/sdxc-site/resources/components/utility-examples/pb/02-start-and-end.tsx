/**
 * A `pb` example with two values, so the block-start and block-end padding differ and
 * each can be told apart in the stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pb } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Different block-start and block-end padding. */
export default {
	title: "Start and end",
	description:
		"Pass two values to pad the block-start and then the block-end edge, like `pb(2, 10)`:",
	render: () => (
		<div mix={[pb(2, 10), demo.stripes()]}>
			<div mix={[demo.block()]}>pb(2, 10)</div>
		</div>
	),
} satisfies UtilityExampleModule;
