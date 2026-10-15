/**
 * A `colorMix` example mixing `currentcolor`, so a border follows whatever text color
 * the element has, at a fraction of its strength.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, colorMix, fg } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Borders derived from each element's own text color. */
export default {
	title: "Deriving from the text color",
	description:
		"Mix `currentcolor` to derive a border or a background from the element's own text color, whatever tone that is:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					fg("brand"),
					border({
						color: colorMix("oklab", { color: "currentcolor", weight: 40 }, "transparent"),
						width: 2,
					}),
					demo.swatch(),
				]}
			>
				brand
			</div>
			<div
				mix={[
					fg("danger"),
					border({
						color: colorMix("oklab", { color: "currentcolor", weight: 40 }, "transparent"),
						width: 2,
					}),
					demo.swatch(),
				]}
			>
				danger
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
