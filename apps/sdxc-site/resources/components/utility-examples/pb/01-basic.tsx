/**
 * The opening `pb` example: a box padded on both block edges, with the padding drawn as
 * stripes above and below it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pb } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on both block edges. */
export default {
	title: "Basic example",
	description:
		"Use `pb(n)` to pad the block-start and block-end edges of an element, its top and bottom in horizontal text:",
	render: () => (
		<div mix={[pb(8), demo.stripes()]}>
			<div mix={[demo.block()]}>pb(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
