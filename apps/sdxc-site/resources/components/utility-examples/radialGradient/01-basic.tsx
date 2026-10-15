/**
 * The opening `radialGradient` example: a circle of one tone fading into another from
 * the element's center, set as its background image.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, radialGradient } from "@sdxc/u/color";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A circular gradient from the center outwards. */
export default {
	title: "Basic example",
	description:
		"Use `radialGradient` with a shape and two or more colors to build a gradient that spreads from a point:",
	render: () => (
		<div
			mix={[
				bg({
					image: radialGradient(
						"circle",
						"var(--ui-color-warning-300)",
						"var(--ui-color-brand-600)",
					),
				}),
				fg("brand.onSolid"),
				is(48),
				bs(32),
				demo.swatch(),
			]}
		>
			circle
		</div>
	),
} satisfies UtilityExampleModule;
