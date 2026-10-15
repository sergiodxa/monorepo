/**
 * The opening `transition` example: a button that lifts and grows on hover, so the
 * reader sees one call animate the properties a state changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "sdxc/u/effects";
import { hover } from "sdxc/u/state";
import { scale, translateY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A hover change animated by naming the property it touches. */
export default {
	title: "Basic example",
	description:
		"Use `transition(properties)` to animate the properties a state changes, with a standard duration and easing. Hover the button:",
	render: () => (
		<button
			type="button"
			mix={[transition("transform"), hover([translateY(-1), scale(1.1)]), demo.button()]}
		>
			Save changes
		</button>
	),
} satisfies UtilityExampleModule;
