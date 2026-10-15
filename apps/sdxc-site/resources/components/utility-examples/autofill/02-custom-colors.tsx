/**
 * An `autofill` example with a background and a text color of its own, for a field that
 * sits on a tinted surface and should stay tinted when filled.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { autofill, surface } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An autofilled field kept on a brand tint. */
export default {
	title: "Custom colors",
	description:
		"Pass a background and a text color, like `brand.tint` and `brand.emphasis`, for a field that lives on a tinted surface:",
	render: () => (
		<form mix={[surface("brand.tinted"), rounded("lg"), p(4)]}>
			<input
				type="text"
				name="name"
				autocomplete="name"
				placeholder="Full name"
				mix={[autofill("brand.tint", "brand.emphasis"), demo.field()]}
			/>
		</form>
	),
} satisfies UtilityExampleModule;
