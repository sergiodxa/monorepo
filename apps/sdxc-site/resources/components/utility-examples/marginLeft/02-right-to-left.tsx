/**
 * A `marginLeft` example in right-to-left text, beside the logical `mis()`, so the
 * reader sees which edge each one keeps when the direction flips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { marginLeft, mis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The physical left margin stays left in right-to-left text. */
export default {
	title: "Right-to-left text",
	description:
		"In right-to-left text `marginLeft()` stays on the left, while `mis()` follows the direction to the start of the line on the right:",
	align: "stretch",
	render: () => (
		<div dir="rtl" mix={[demo.stack()]}>
			<div mix={[demo.marginArea()]}>
				<div mix={[marginLeft(12), demo.block()]}>marginLeft(12)</div>
			</div>
			<div mix={[demo.marginArea()]}>
				<div mix={[mis(12), demo.block()]}>mis(12)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
