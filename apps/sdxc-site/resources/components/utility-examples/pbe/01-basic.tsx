/**
 * The opening `pbe` example: a box padded on its block-end edge only, with the padding
 * drawn as stripes below it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pbe } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on the block-end edge only. */
export default {
	title: "Basic example",
	description:
		"Use `pbe(n)` to pad the block-end edge of an element, its bottom in horizontal text:",
	render: () => (
		<div mix={[pbe(8), demo.stripes()]}>
			<div mix={[demo.block()]}>pbe(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
