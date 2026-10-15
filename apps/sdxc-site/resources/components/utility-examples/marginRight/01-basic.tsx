/**
 * The opening `marginRight` example: a box with margin on its physical right edge, drawn
 * as stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { marginRight } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on the physical right edge. */
export default {
	title: "Basic example",
	description:
		"Use `marginRight(n)` to add margin to the right edge of an element, whatever the writing direction:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[marginRight(12), demo.block()]}>marginRight(12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
