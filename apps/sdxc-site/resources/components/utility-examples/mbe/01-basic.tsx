/**
 * The opening `mbe` example: one box with margin on its block-end edge only, drawn as
 * stripes below it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mbe } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on the block-end edge only. */
export default {
	title: "Basic example",
	description:
		"Use `mbe(n)` to add margin to the block-end edge of an element, below it in horizontal text:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[mbe(8), demo.block()]}>mbe(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
