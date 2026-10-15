/**
 * A `lineClamp` example with different counts on the same text, so the reader sees the
 * number decide where the ellipsis lands.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { lineClamp } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One review clamped to one line and to two. */
export default {
	title: "Changing the line count",
	description:
		"Pass a smaller number for a tighter preview, like `lineClamp(1)` in a list of messages:",
	render: () => (
		<div mix={[maxIs(80), demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>lineClamp(1)</p>
				<p mix={[lineClamp(1)]}>
					The pasta was perfect and the tiramisu even better, but we waited forty minutes for a
					table we had booked a week ahead, and nobody apologised.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>lineClamp(2)</p>
				<p mix={[lineClamp(2)]}>
					The pasta was perfect and the tiramisu even better, but we waited forty minutes for a
					table we had booked a week ahead, and nobody apologised.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
