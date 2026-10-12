/**
 * A `transitionDuration` example that drops a transition to zero for readers who ask for
 * reduced motion, while the property list and easing set elsewhere stay as they are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition, transitionDuration } from "@sdxc/u/effects";
import { media } from "@sdxc/u/responsive";
import { hover } from "@sdxc/u/state";
import { scale } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A transition shortened to nothing under a reduced-motion preference. */
export default {
	title: "Respecting reduced motion",
	description:
		'Set it inside `media()` to shorten a transition declared elsewhere, like dropping it to `"0s"` when the reader prefers reduced motion. Hover the button:',
	render: () => (
		<button
			type="button"
			mix={[
				transition("transform", { duration: 500 }),
				media("(prefers-reduced-motion: reduce)", transitionDuration("0s")),
				hover(scale(1.2)),
				demo.button(),
			]}
		>
			Hover me
		</button>
	),
} satisfies UtilityExampleModule;
