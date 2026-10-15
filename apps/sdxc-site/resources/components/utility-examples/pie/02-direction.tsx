/**
 * A `pie` example in both writing directions, so the reader sees the padding move to the
 * left once the text runs right to left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pie } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The inline-end padding follows the writing direction. */
export default {
	title: "Writing direction",
	description:
		"`pie()` follows the writing direction: on the right in left-to-right text and on the left in right-to-left text:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div dir="ltr" mix={[pie(12), demo.stripes()]}>
				<div mix={[demo.block()]}>ltr</div>
			</div>
			<div dir="rtl" mix={[pie(12), demo.stripes()]}>
				<div mix={[demo.block()]}>rtl</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
