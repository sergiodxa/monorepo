/**
 * The opening `ring` example: buttons and a field that show a focus ring only under
 * keyboard focus, from one call each.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ring } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A focus ring on a button and on a field. */
export default {
	title: "Basic example",
	description:
		"Use `ring()` to draw a focus ring that shows only for keyboard focus. Tab through the controls to see it:",
	render: () => (
		<div mix={[demo.row()]}>
			<button type="button" mix={[ring(), demo.block()]}>
				Save
			</button>
			<input type="text" placeholder="Search" aria-label="Search" mix={[ring(), demo.field()]} />
		</div>
	),
} satisfies UtilityExampleModule;
