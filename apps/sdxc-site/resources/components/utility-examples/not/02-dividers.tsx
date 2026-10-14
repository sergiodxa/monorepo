/**
 * A `not` example drawing a divider under every row but the last, so the reader sees a
 * structural pseudo-class negated to avoid a stray border at the end of a list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { borderEdge } from "@sdxc/u/color";
import { pb } from "@sdxc/u/size";
import { not } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A bottom border on each item except the final one. */
export default {
	title: "Every item but the last",
	description:
		'Negate a structural pseudo-class, like `not(":last-child", …)`, to separate items without a border after the final one:',
	render: () => (
		<ul mix={[demo.panel()]}>
			<li
				mix={[
					pb(2),
					not(":last-child", borderEdge("block-end", { color: "neutral.border", width: 1 })),
					demo.prose(),
				]}
			>
				Inbox
			</li>
			<li
				mix={[
					pb(2),
					not(":last-child", borderEdge("block-end", { color: "neutral.border", width: 1 })),
					demo.prose(),
				]}
			>
				Drafts
			</li>
			<li
				mix={[
					pb(2),
					not(":last-child", borderEdge("block-end", { color: "neutral.border", width: 1 })),
					demo.prose(),
				]}
			>
				Sent
			</li>
		</ul>
	),
} satisfies UtilityExampleModule;
