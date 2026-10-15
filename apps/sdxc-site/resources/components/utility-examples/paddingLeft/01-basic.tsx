/**
 * The opening `paddingLeft` example: a box padded on its physical left edge, with the
 * padding drawn as stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { paddingLeft } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on the physical left edge. */
export default {
	title: "Basic example",
	description:
		"Use `paddingLeft(n)` to pad the left edge of an element, whatever the writing direction:",
	render: () => (
		<div mix={[paddingLeft(12), demo.stripes()]}>
			<div mix={[demo.block()]}>paddingLeft(12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
