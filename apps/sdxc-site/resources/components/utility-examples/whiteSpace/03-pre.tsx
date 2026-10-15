/**
 * A `whiteSpace` example with `"pre"`, which keeps every space and line break and never
 * wraps, so a long line runs past the edge of a narrow card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { whiteSpace } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A log excerpt kept exactly as written, overflowing its card. */
export default {
	title: "Preserving everything",
	description:
		'Use `whiteSpace("pre")` to keep every space and line break exactly as written, without wrapping:',
	render: () => (
		<div mix={[maxIs(72), demo.panel()]}>
			<p mix={[whiteSpace("pre")]}>
				{
					"12:04:51  GET   /api/orders        200   18ms\n12:04:52  POST  /api/orders/checkout  201   142ms"
				}
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
