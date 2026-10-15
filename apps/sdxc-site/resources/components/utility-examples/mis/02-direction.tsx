/**
 * A `mis` example in both writing directions, so the reader sees the margin move to the
 * right once the text runs right to left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The inline-start margin follows the writing direction. */
export default {
	title: "Writing direction",
	description:
		"`mis()` follows the writing direction: on the left in left-to-right text and on the right in right-to-left text:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div dir="ltr" mix={[demo.marginArea()]}>
				<div mix={[mis(12), demo.block()]}>ltr</div>
			</div>
			<div dir="rtl" mix={[demo.marginArea()]}>
				<div mix={[mis(12), demo.block()]}>rtl</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
