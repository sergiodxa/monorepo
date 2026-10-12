/**
 * A `scaleProperty` example on a button that shrinks while pressed, the tactile press
 * effect most UI kits give a button, so the reader can try it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "@sdxc/u/effects";
import { active } from "@sdxc/u/state";
import { scaleProperty } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A pressed button shrinking through the `scale` property. */
export default {
	title: "Pressing a button",
	description:
		'Wrap it in `active()` to shrink a button while it is pressed, with a `transition("scale")` to ease it. Press the button to try it:',
	render: () => (
		<button type="button" mix={[active(scaleProperty(0.95)), transition("scale"), demo.block()]}>
			Press me
		</button>
	),
} satisfies UtilityExampleModule;
