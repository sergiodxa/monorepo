/**
 * An `open` example on a popover, which matches through `:popover-open`, toggled with
 * `popovertarget` so the reader opens and closes it with no JavaScript.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { opacity, transition, transitionBehavior } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { open, when } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Transparent while closed, opaque while open, fading between the two both ways. */
export default {
	title: "Popovers",
	description:
		'`open()` also matches a popover while it is shown; with `when("@starting-style", …)` it fades in. Click the button to toggle the popover:',
	render: () => (
		<div>
			<button
				type="button"
				popovertarget="open-popover"
				mix={[bg("brand.solid"), fg("brand.onSolid"), cursor("pointer"), demo.control()]}
			>
				Notifications
			</button>
			<div
				id="open-popover"
				popover
				mix={[
					opacity(0),
					open([opacity(100), when("@starting-style", opacity(0))]),
					transition("opacity, display, overlay", { duration: 200 }),
					transitionBehavior("allow-discrete"),
					demo.card(),
				]}
			>
				You have no new notifications.
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
