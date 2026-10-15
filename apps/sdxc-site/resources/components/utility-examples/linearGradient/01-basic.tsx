/**
 * The opening `linearGradient` example: a gradient between two tones laid along one
 * direction, set as an element's background image.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, linearGradient } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A brand to danger gradient running left to right. */
export default {
	title: "Basic example",
	description:
		"Use `linearGradient` with a direction and two or more colors to build a gradient for a background image:",
	render: () => (
		<div
			mix={[
				bg({
					image: linearGradient(
						"to right",
						"var(--ui-color-brand-500)",
						"var(--ui-color-danger-400)",
					),
				}),
				fg("brand.onSolid"),
				demo.swatch(),
			]}
		>
			linearGradient("to right", ...)
		</div>
	),
} satisfies UtilityExampleModule;
