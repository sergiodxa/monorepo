/**
 * The opening `mie` example: one box with margin on its inline-end edge only, drawn as
 * stripes after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mie } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on the inline-end edge only. */
export default {
	title: "Basic example",
	description:
		"Use `mie(n)` to add margin to the inline-end edge of an element, its right in left-to-right text:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[mie(12), demo.block()]}>mie(12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
