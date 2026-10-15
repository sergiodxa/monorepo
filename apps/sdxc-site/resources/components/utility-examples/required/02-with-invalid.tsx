/**
 * A `required` example paired with `invalid`: the field reads as required from the start
 * and as an error only after the reader has cleared it, so the two states stay distinct.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "sdxc/u/color";
import { vstack } from "sdxc/u/layout";
import { invalid, required } from "sdxc/u/state";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Required paints a brand border up front; invalid, written after it, takes over on error. */
export default {
	title: "Combining with invalid",
	description:
		"Pair `required()` with `invalid()` so an untouched required field never looks like an error. Clear the field, then click outside it:",
	render: () => (
		<label mix={[vstack({ gap: 1 }), text("sm"), weight("medium")]}>
			Project name (required)
			<input
				type="text"
				required
				value="Uptime"
				mix={[
					border("neutral.border"),
					required(border("brand.strong")),
					invalid([border("danger.strong"), fg("danger")]),
					demo.input(),
				]}
			/>
		</label>
	),
} satisfies UtilityExampleModule;
