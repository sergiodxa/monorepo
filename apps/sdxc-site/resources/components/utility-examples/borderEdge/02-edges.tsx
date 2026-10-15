/**
 * A `borderEdge` example with one box per logical edge, so a reader sees which side each
 * edge name draws on in a left-to-right page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { borderEdge } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One box per logical edge. */
export default {
	title: "Logical edges",
	description:
		"Name a logical edge, `block-start`, `inline-end`, `block-end` or `inline-start`, so the border follows the writing mode:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[borderEdge("block-start", { color: "brand.strong", width: 4 }), demo.swatch()]}>
				block-start
			</div>
			<div mix={[borderEdge("inline-end", { color: "brand.strong", width: 4 }), demo.swatch()]}>
				inline-end
			</div>
			<div mix={[borderEdge("block-end", { color: "brand.strong", width: 4 }), demo.swatch()]}>
				block-end
			</div>
			<div mix={[borderEdge("inline-start", { color: "brand.strong", width: 4 }), demo.swatch()]}>
				inline-start
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
