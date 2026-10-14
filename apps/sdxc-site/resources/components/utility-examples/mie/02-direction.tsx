/**
 * An `mie` example in both writing directions, so the reader sees the margin move to the
 * left once the text runs right to left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mie } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The inline-end margin follows the writing direction. */
export default {
	title: "Writing direction",
	description:
		"`mie()` follows the writing direction: on the right in left-to-right text and on the left in right-to-left text:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div dir="ltr" mix={[demo.marginArea()]}>
				<div mix={[mie(12), demo.block()]}>ltr</div>
			</div>
			<div dir="rtl" mix={[demo.marginArea()]}>
				<div mix={[mie(12), demo.block()]}>rtl</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
