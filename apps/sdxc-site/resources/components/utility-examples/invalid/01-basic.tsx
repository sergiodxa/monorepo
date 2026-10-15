/**
 * The opening `invalid` example: an email field that turns red once the reader has typed
 * something that is not an address and left it, never while it is still untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg, outline } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { invalid } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A danger border and text color, held back until the user has interacted with the field. */
export default {
	title: "Basic example",
	description:
		'Wrap utilities in `invalid()` to style a field that fails validation after the user has edited it. Type "hello" in the field, then click outside it:',
	render: () => (
		<label mix={[vstack({ gap: 1 }), text("sm"), weight("medium")]}>
			Email
			<input
				type="email"
				required
				placeholder="you@example.com"
				mix={[
					border("neutral.border"),
					invalid([border("danger.strong"), fg("danger"), outline({ color: "danger", width: 1 })]),
					demo.input(),
				]}
			/>
		</label>
	),
} satisfies UtilityExampleModule;
