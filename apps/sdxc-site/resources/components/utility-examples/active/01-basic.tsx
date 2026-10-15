/**
 * The opening `active` example: a button that shrinks while it is pressed, so the reader
 * holds the mouse down on it and feels the press the state wrapper draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { transition } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { active } from "@sdxc/u/state";
import { scale } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scale applied only for as long as the button is held down. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `active()` to apply them while the element is being pressed. Press and hold the button:",
	render: () => (
		<button
			type="button"
			mix={[
				bg("brand.solid"),
				fg("brand.onSolid"),
				active(scale(0.95)),
				transition("transform", { duration: 100 }),
				cursor("pointer"),
				demo.control(),
			]}
		>
			Press me
		</button>
	),
} satisfies UtilityExampleModule;
