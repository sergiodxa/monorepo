/**
 * The opening `pbs` example: a box padded on its block-start edge only, with the padding
 * drawn as stripes above it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pbs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on the block-start edge only. */
export default {
	title: "Basic example",
	description:
		"Use `pbs(n)` to pad the block-start edge of an element, its top in horizontal text:",
	render: () => (
		<div mix={[pbs(8), demo.stripes()]}>
			<div mix={[demo.block()]}>pbs(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
