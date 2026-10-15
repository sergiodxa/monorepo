/**
 * A `translateX` example applied on hover with a transition, the nudge an arrow in a button
 * gives as the pointer reaches it, so the reader can try it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "sdxc/u/effects";
import { inlineBlock } from "sdxc/u/layout";
import { hover, when } from "sdxc/u/state";
import { translateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An arrow nudged forward while its button is hovered. */
export default {
	title: "Applying on hover",
	description:
		"Combine it with `hover()` to nudge part of a button forward. Hover the button to try it:",
	render: () => (
		<button type="button" mix={[hover(when("& span", translateX(2))), demo.block()]}>
			Read more <span mix={[inlineBlock(), transition("transform")]}>→</span>
		</button>
	),
} satisfies UtilityExampleModule;
