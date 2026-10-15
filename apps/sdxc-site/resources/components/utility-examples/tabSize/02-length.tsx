/**
 * A `tabSize` example with a length instead of a count, sizing each tab from a unit the
 * rest of the layout already uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { tabSize } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tab-separated table of figures aligned by a tab stop given as a length. */
export default {
	title: "Using a length",
	description: 'Pass a length, like `tabSize("6rem")`, to set tab stops in any unit:',
	render: () => (
		<pre mix={[tabSize("6rem"), demo.panel()]}>
			{"City\tHigh\tLow\nLisbon\t24°\t17°\nOslo\t12°\t4°\nCairo\t33°\t21°"}
		</pre>
	),
} satisfies UtilityExampleModule;
