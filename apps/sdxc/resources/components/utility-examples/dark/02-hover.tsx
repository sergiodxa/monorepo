/**
 * A `dark` example combined with a state, so a button keeps a hover color of its own in
 * each theme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { cursor } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { hover } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A hover color that differs per theme. */
export default {
	title: "Combining with states",
	description:
		"Nest a state inside `dark(...)` to give it a dark-mode value, like `dark(hover(bg(...)))`. Hover the button in light and in dark mode:",
	render: () => (
		<button
			type="button"
			mix={[
				bg("color.brand.600"),
				fg("color.brand.50"),
				hover(bg("color.brand.700")),
				dark(hover(bg("color.brand.400"))),
				cursor("pointer"),
				demo.control(),
			]}
		>
			Save changes
		</button>
	),
} satisfies UtilityExampleModule;
