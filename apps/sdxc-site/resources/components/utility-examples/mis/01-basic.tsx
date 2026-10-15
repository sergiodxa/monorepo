/**
 * The opening `mis` example: one box with margin on its inline-start edge only, drawn as
 * stripes before it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mis } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on the inline-start edge only. */
export default {
	title: "Basic example",
	description:
		"Use `mis(n)` to add margin to the inline-start edge of an element, its left in left-to-right text:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[mis(12), demo.block()]}>mis(12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
