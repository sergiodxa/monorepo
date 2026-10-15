/**
 * An `m` example with four values, one per edge in logical order, so each side's margin
 * can be told apart in the stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { m } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One margin per edge, starting at block-start. */
export default {
	title: "Each side",
	description:
		"Pass four values to set the block-start, inline-end, block-end and inline-start margins in that order, like `m(2, 8, 6, 4)`:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[m(2, 8, 6, 4), demo.block()]}>m(2, 8, 6, 4)</div>
		</div>
	),
} satisfies UtilityExampleModule;
