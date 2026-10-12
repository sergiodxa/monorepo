/**
 * A `divide` example along the inline axis, so the dividers run vertically between items
 * laid out in a row, as in a toolbar or a stat strip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { divide } from "@sdxc/u/overflow";
import { pi } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Vertical dividers between items in a row. */
export default {
	title: "Dividing a row",
	description: 'Pass `"inline"` to divide children laid out side by side:',
	render: () => (
		<div mix={[hstack(), divide("inline"), demo.panel()]}>
			<span mix={[pi(4)]}>Bold</span>
			<span mix={[pi(4)]}>Italic</span>
			<span mix={[pi(4)]}>Underline</span>
		</div>
	),
} satisfies UtilityExampleModule;
