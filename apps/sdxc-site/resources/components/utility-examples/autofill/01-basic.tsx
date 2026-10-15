/**
 * The opening `autofill` example: a sign-in field that keeps the page's own background
 * and text color when the browser fills it in, in place of the browser's yellow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { autofill } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An email field that keeps its colors when autofilled. */
export default {
	title: "Basic example",
	description:
		"Use `autofill()` to keep an autofilled field on the page's own background and text color. Let the browser fill the field to see it:",
	render: () => (
		<form mix={[demo.stack()]}>
			<input
				type="email"
				name="email"
				autocomplete="email"
				placeholder="you@example.com"
				mix={[autofill(), demo.field()]}
			/>
		</form>
	),
} satisfies UtilityExampleModule;
