/**
 * An `active` example stacked on `hover`, giving one button a resting, a hovered and a
 * pressed color, so the reader sees the two states hand over to each other in order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { transition } from "sdxc/u/effects";
import { cursor } from "sdxc/u/general";
import { active, hover } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Three backgrounds, one per state, with the pressed one written last so it wins. */
export default {
	title: "Combining with hover",
	description:
		"Put `active()` after `hover()` so the pressed style wins while both apply. Hover the button, then press it:",
	render: () => (
		<button
			type="button"
			mix={[
				bg("brand.solid"),
				fg("brand.onSolid"),
				hover(bg("color.brand.700")),
				active(bg("color.brand.900")),
				transition("background-color"),
				cursor("pointer"),
				demo.control(),
			]}
		>
			Add to cart
		</button>
	),
} satisfies UtilityExampleModule;
