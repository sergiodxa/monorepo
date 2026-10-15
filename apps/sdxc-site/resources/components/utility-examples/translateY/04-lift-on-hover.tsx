/**
 * A `translateY` example that lifts a card on hover with a transition, the raise a
 * clickable card gives under the pointer, so the reader can try it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "@sdxc/u/effects";
import { hover } from "@sdxc/u/state";
import { translateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card lifted while hovered. */
export default {
	title: "Lifting on hover",
	description:
		'Combine it with `hover()` and a `transition("transform")` to lift a card under the pointer. Hover the card to try it:',
	render: () => (
		<div mix={[hover(translateY(-1)), transition("transform"), demo.card()]}>
			Hover to lift this card
		</div>
	),
} satisfies UtilityExampleModule;
