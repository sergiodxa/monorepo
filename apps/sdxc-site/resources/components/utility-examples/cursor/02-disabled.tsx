/**
 * A `cursor` example combined with the disabled state: a button that shows a pointer while
 * it can be pressed and a not-allowed sign once it cannot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { opacity } from "sdxc/u/effects";
import { cursor } from "sdxc/u/general";
import { disabled } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An enabled and a disabled button with the cursor each state calls for. */
export default {
	title: "Disabled controls",
	description:
		'Combine `cursor("pointer")` with `disabled(cursor("not-allowed"))` so a control signals when it cannot be used. Hover both buttons:',
	render: () => (
		<div mix={[demo.row()]}>
			<button
				mix={[cursor("pointer"), disabled([cursor("not-allowed"), opacity(50)]), demo.block()]}
			>
				Publish
			</button>
			<button
				disabled
				mix={[cursor("pointer"), disabled([cursor("not-allowed"), opacity(50)]), demo.block()]}
			>
				Publish
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
