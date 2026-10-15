/**
 * The opening `paddingRight` example: a box padded on its physical right edge, with the
 * padding drawn as stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { paddingRight } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on the physical right edge. */
export default {
	title: "Basic example",
	description:
		"Use `paddingRight(n)` to pad the right edge of an element, whatever the writing direction:",
	render: () => (
		<div mix={[paddingRight(12), demo.stripes()]}>
			<div mix={[demo.block()]}>paddingRight(12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
