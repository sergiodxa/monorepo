/**
 * The opening `mb` example: one box with margin on both block edges, drawn as stripes
 * above and below it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mb } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on both block edges. */
export default {
	title: "Basic example",
	description:
		"Use `mb(n)` to add margin to the block-start and block-end edges of an element, above and below it in horizontal text:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[mb(8), demo.block()]}>mb(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
