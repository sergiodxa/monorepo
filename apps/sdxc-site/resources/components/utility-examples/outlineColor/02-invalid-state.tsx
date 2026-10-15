/**
 * An `outlineColor` example scoped to the invalid state, so a field's outline turns to
 * the danger tone only once the reader has entered something invalid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outlineColor, outlineStyle, outlineWidth } from "@sdxc/u/color";
import { invalid } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A field whose outline turns red once its value is invalid. */
export default {
	title: "Applying on a state",
	description:
		"Wrap `outlineColor` in a state, like `invalid()`, to recolor an outline only in that state. Type something that is not an email and leave the field:",
	render: () => (
		<input
			type="email"
			placeholder="you@example.com"
			aria-label="Email"
			mix={[outlineWidth(2), outlineStyle("solid"), invalid(outlineColor("danger")), demo.field()]}
		/>
	),
} satisfies UtilityExampleModule;
