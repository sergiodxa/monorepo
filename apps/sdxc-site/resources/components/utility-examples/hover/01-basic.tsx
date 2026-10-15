/**
 * The opening `hover` example: a button that darkens while the pointer is over it, so
 * the reader triggers the state with the mouse and sees which styles it swaps in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { transition } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { hover } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A darker background swapped in only while the pointer rests on the button. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `hover()` to apply them only while the pointer is over the element. Hover the button to darken its background:",
	render: () => (
		<button
			type="button"
			mix={[
				bg("brand.solid"),
				fg("brand.onSolid"),
				hover(bg("color.brand.800")),
				transition("background-color"),
				cursor("pointer"),
				demo.control(),
			]}
		>
			Save changes
		</button>
	),
} satisfies UtilityExampleModule;
