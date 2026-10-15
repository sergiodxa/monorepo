/**
 * A `paddingLeft` example in right-to-left text, beside the logical `pis()`, so the
 * reader sees which edge each one keeps when the direction flips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { paddingLeft, pis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The physical left padding stays left in right-to-left text. */
export default {
	title: "Right-to-left text",
	description:
		"In right-to-left text `paddingLeft()` stays on the left, while `pis()` follows the direction to the start of the line on the right:",
	align: "stretch",
	render: () => (
		<div dir="rtl" mix={[demo.stack()]}>
			<div mix={[paddingLeft(12), demo.stripes()]}>
				<div mix={[demo.block()]}>paddingLeft(12)</div>
			</div>
			<div mix={[pis(12), demo.stripes()]}>
				<div mix={[demo.block()]}>pis(12)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
