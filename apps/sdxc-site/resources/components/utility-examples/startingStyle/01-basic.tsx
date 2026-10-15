/**
 * The opening `startingStyle` example: a popover that fades in as it opens, because its
 * opacity transitions from the starting value instead of appearing at full strength.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { opacity, transition, transitionBehavior } from "sdxc/u/effects";
import { cursor } from "sdxc/u/general";
import { startingStyle } from "sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A popover that fades in on open. */
export default {
	title: "Basic example",
	description:
		"Use `startingStyle(...)` to set the values an element transitions from when it first appears, like a popover leaving `display: none`. Open the popover:",
	render: () => (
		<div>
			<button
				type="button"
				popovertarget="starting-style-fade"
				mix={[bg("brand.solid"), fg("brand.onSolid"), cursor("pointer"), demo.control()]}
			>
				Show tip
			</button>
			<div
				id="starting-style-fade"
				popover="auto"
				mix={[
					opacity(100),
					transition("opacity, display, overlay", { duration: 400 }),
					transitionBehavior("allow-discrete"),
					startingStyle(opacity(0)),
					demo.card(),
				]}
			>
				Press Escape to close.
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
