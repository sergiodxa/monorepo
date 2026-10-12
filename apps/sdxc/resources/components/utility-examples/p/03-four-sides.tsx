/**
 * A `p` example with four values, one per edge in logical order, so each side's padding
 * can be told apart in the stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One padding per edge, starting at block-start. */
export default {
	title: "Each side",
	description:
		"Pass four values to pad the block-start, inline-end, block-end and inline-start edges in that order, like `p(2, 8, 6, 4)`:",
	render: () => (
		<div mix={[p(2, 8, 6, 4), demo.stripes()]}>
			<div mix={[demo.block()]}>p(2, 8, 6, 4)</div>
		</div>
	),
} satisfies UtilityExampleModule;
