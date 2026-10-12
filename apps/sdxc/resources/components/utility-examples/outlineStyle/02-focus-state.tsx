/**
 * An `outlineStyle` example scoped to keyboard focus, where a dashed outline appears on
 * a button only when it is focused from the keyboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outlineColor, outlineStyle, outlineWidth } from "@sdxc/u/color";
import { focusVisible } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A button whose dashed outline appears on keyboard focus. */
export default {
	title: "Applying on a state",
	description:
		"Wrap `outlineStyle` in a state, like `focusVisible()`, to draw the outline only then. Tab to the button to see it:",
	render: () => (
		<button
			type="button"
			mix={[
				outlineWidth(2),
				outlineColor("brand"),
				focusVisible(outlineStyle("dashed")),
				demo.block(),
			]}
		>
			Save changes
		</button>
	),
} satisfies UtilityExampleModule;
