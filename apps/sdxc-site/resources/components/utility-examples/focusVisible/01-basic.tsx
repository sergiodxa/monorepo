/**
 * The opening `focusVisible` example: a button that draws a ring only when the keyboard
 * moved focus to it, so the reader compares tabbing to it with clicking it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, outline } from "@sdxc/u/color";
import { cursor } from "@sdxc/u/general";
import { focusVisible } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An offset brand outline that appears for keyboard focus and stays hidden on click. */
export default {
	title: "Basic example",
	description:
		"Use `focusVisible()` to style focus only when the browser decides to show it, as it does for the keyboard. Tab to the button, then click it to compare:",
	render: () => (
		<button
			type="button"
			mix={[
				bg("brand.solid"),
				fg("brand.onSolid"),
				outline("none"),
				focusVisible(outline({ color: "brand", width: 2, offset: 2 })),
				cursor("pointer"),
				demo.control(),
			]}
		>
			Continue
		</button>
	),
} satisfies UtilityExampleModule;
