/**
 * An `hstack` example with `justify`: a toolbar whose title and actions are pushed to
 * opposite ends of the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The justify option spreads the stack's groups across the row. */
export default {
	title: "Justifying items",
	description:
		'Use the `justify` option to distribute items along the row, like `justify: "between"` for a toolbar:',
	align: "stretch",
	render: () => (
		<div mix={[hstack({ align: "center", justify: "between" }), demo.panel()]}>
			<span mix={[weight("semibold")]}>Inbox</span>
			<div mix={[hstack({ gap: 2 })]}>
				<button type="button" mix={[demo.button()]}>
					Archive
				</button>
				<button type="button" mix={[demo.button()]}>
					Reply
				</button>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
