/**
 * The opening `transitionBehavior` example: a popover that fades in and out, which works
 * because `"allow-discrete"` lets `display` and `overlay` take part in the transition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { opacity, transition, transitionBehavior } from "@sdxc/u/effects";
import { startingStyle } from "@sdxc/u/responsive";
import { open } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A popover fading in and out across its display change. */
export default {
	title: "Basic example",
	description:
		'Use `transitionBehavior("allow-discrete")` to let discrete properties like `display` transition, so an element can fade in and out as it\'s shown and hidden. Toggle the popover:',
	render: () => (
		<div>
			<button type="button" popovertarget="note" mix={[demo.button()]}>
				Toggle note
			</button>
			<div
				id="note"
				popover
				mix={[
					transition("opacity, display, overlay", { duration: 300 }),
					transitionBehavior("allow-discrete"),
					opacity(0),
					open(opacity(100)),
					startingStyle(open(opacity(0))),
					demo.panel(),
				]}
			>
				Saved a minute ago.
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
