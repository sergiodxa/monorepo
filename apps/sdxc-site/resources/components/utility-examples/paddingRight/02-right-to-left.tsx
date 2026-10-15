/**
 * A `paddingRight` example in right-to-left text, beside the logical `pie()`, so the
 * reader sees which edge each one keeps when the direction flips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { paddingRight, pie } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The physical right padding stays right in right-to-left text. */
export default {
	title: "Right-to-left text",
	description:
		"In right-to-left text `paddingRight()` stays on the right, while `pie()` follows the direction to the end of the line on the left:",
	align: "stretch",
	render: () => (
		<div dir="rtl" mix={[demo.stack()]}>
			<div mix={[paddingRight(12), demo.stripes()]}>
				<div mix={[demo.block()]}>paddingRight(12)</div>
			</div>
			<div mix={[pie(12), demo.stripes()]}>
				<div mix={[demo.block()]}>pie(12)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
