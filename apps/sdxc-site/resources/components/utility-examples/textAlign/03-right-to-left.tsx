/**
 * A `textAlign` example in a right-to-left box, where the logical `"start"` follows the
 * writing direction and a physical `"left"` stays put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { textAlign } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Arabic text aligned to its logical start and to the physical left. */
export default {
	title: "Following the writing direction",
	description:
		'`textAlign("start")` and `textAlign("end")` follow the writing direction, so they flip under `dir="rtl"`; pass `"left"` or `"right"` for an alignment that never flips:',
	render: () => (
		<div dir="rtl" lang="ar" mix={[maxIs(96), demo.stack()]}>
			<div mix={[demo.panel()]}>
				<p dir="ltr" mix={[demo.caption()]}>
					textAlign("start")
				</p>
				<p mix={[textAlign("start")]}>مرحبًا بكم في متجرنا الجديد</p>
			</div>
			<div mix={[demo.panel()]}>
				<p dir="ltr" mix={[demo.caption()]}>
					textAlign("left")
				</p>
				<p mix={[textAlign("left")]}>مرحبًا بكم في متجرنا الجديد</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
