/**
 * The opening `mbs` example: one box with margin on its block-start edge only, drawn as
 * stripes above it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mbs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on the block-start edge only. */
export default {
	title: "Basic example",
	description:
		"Use `mbs(n)` to add margin to the block-start edge of an element, above it in horizontal text:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[mbs(8), demo.block()]}>mbs(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
