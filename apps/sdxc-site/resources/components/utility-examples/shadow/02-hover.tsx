/**
 * A `shadow` example that raises a card on hover, so the reader sees a state swap one
 * step of the scale for another and a transition ease between them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { shadow, transition } from "sdxc/u/effects";
import { hover } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card that lifts to a deeper shadow when hovered. */
export default {
	title: "Lifting on hover",
	description:
		'Override the step with `hover(shadow("xl"))` to lift an element when it\'s hovered. Hover the card:',
	render: () => (
		<a
			href="/articles/latest"
			mix={[
				shadow("sm"),
				hover(shadow("xl")),
				transition("box-shadow", { duration: 200 }),
				demo.panel(),
			]}
		>
			Read the full article
		</a>
	),
} satisfies UtilityExampleModule;
