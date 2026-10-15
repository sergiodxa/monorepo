/**
 * An `insIe` example in both writing directions: the same call holds the box to the right
 * in left-to-right text and to the left in right-to-left text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insIe, relative } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The logical offset follows the text direction, so one call serves both. */
export default {
	title: "Right-to-left support",
	description:
		"The offset follows the writing direction, so `insIe(4)` holds to the right in `ltr` text and to the left in `rtl` text:",
	render: () => (
		<div mix={[demo.row()]}>
			<div dir="ltr" mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insIe(4), demo.block()]}>ltr</div>
			</div>
			<div dir="rtl" mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insIe(4), demo.block()]}>rtl</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
