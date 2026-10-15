/**
 * A `marginRight` example in right-to-left text, beside the logical `mie()`, so the
 * reader sees which edge each one keeps when the direction flips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { marginRight, mie } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The physical right margin stays right in right-to-left text. */
export default {
	title: "Right-to-left text",
	description:
		"In right-to-left text `marginRight()` stays on the right, while `mie()` follows the direction to the end of the line on the left:",
	align: "stretch",
	render: () => (
		<div dir="rtl" mix={[demo.stack()]}>
			<div mix={[demo.marginArea()]}>
				<div mix={[marginRight(12), demo.block()]}>marginRight(12)</div>
			</div>
			<div mix={[demo.marginArea()]}>
				<div mix={[mie(12), demo.block()]}>mie(12)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
