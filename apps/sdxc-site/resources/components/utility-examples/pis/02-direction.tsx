/**
 * A `pis` example in both writing directions, so the reader sees the padding move to the
 * right once the text runs right to left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The inline-start padding follows the writing direction. */
export default {
	title: "Writing direction",
	description:
		"`pis()` follows the writing direction: on the left in left-to-right text and on the right in right-to-left text:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div dir="ltr" mix={[pis(12), demo.stripes()]}>
				<div mix={[demo.block()]}>ltr</div>
			</div>
			<div dir="rtl" mix={[pis(12), demo.stripes()]}>
				<div mix={[demo.block()]}>rtl</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
