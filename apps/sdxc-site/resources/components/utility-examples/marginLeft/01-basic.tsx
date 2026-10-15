/**
 * The opening `marginLeft` example: a box with margin on its physical left edge, drawn
 * as stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { marginLeft } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on the physical left edge. */
export default {
	title: "Basic example",
	description:
		"Use `marginLeft(n)` to add margin to the left edge of an element, whatever the writing direction:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[marginLeft(12), demo.block()]}>marginLeft(12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
