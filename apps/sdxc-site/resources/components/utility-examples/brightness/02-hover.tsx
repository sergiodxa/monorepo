/**
 * A `brightness` example that lifts on hover, the usual affordance on a clickable image,
 * so the reader can feel the change it makes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { brightness, transition } from "sdxc/u/effects";
import { hover } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An image link that brightens when hovered. */
export default {
	title: "Brightening on hover",
	description:
		"Combine it with `hover()` and `transition()` to light up a clickable image. Hover the photograph:",
	render: () => (
		<a href="/gallery/landscape">
			<img
				mix={[hover(brightness(1.25)), transition("filter"), demo.thumb()]}
				src={demo.photoUrl()}
				alt="Landscape"
			/>
		</a>
	),
} satisfies UtilityExampleModule;
