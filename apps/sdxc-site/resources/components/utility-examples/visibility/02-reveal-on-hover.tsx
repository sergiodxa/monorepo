/**
 * A `visibility` example that reveals a row's action while the row is hovered or
 * focused, so the reader sees `visibility()` bring back an element that kept its space.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visibility } from "sdxc/u/effects";
import { hstack } from "sdxc/u/layout";
import { when } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row action shown while its row is hovered or holds focus. */
export default {
	title: "Showing on hover",
	description:
		'Hide an element with `visibility("hidden")` and bring it back with `visibility()` in a state. Hover the row:',
	render: () => (
		<div mix={[hstack({ gap: 4, justify: "between" }), demo.panel()]}>
			<span>invoice-0425.pdf</span>
			<button
				type="button"
				mix={[
					visibility("hidden"),
					when(":is(:hover, :focus-within) > &", visibility()),
					demo.button(),
				]}
			>
				Remove
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
