/**
 * A `bg` example with an options object, painting a dot pattern from a gradient image
 * sized, positioned and repeated in one call, so a reader sees the background properties
 * set together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, radialGradient } from "sdxc/u/color";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A repeating dot pattern drawn by a gradient image, with its size, position and repeat. */
export default {
	title: "Background images",
	description:
		"Pass an object to set the background image, size, position and repeat together; only the keys you give are set:",
	render: () => (
		<div
			mix={[
				bg({
					color: "brand.tint",
					image: radialGradient("circle", "var(--ui-brand-border-strong) 2px", "transparent 2.5px"),
					size: "1rem 1rem",
					position: "center",
					repeat: "repeat",
				}),
				fg("brand.emphasis"),
				is(64),
				bs(32),
				demo.swatch(),
			]}
		>
			image, size and repeat
		</div>
	),
} satisfies UtilityExampleModule;
