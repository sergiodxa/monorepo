/**
 * A `forcedColors` example that keeps a swatch's own colors in forced-colors mode,
 * where the color itself is the content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { forcedColorAdjust } from "@sdxc/u/a11y";
import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { forcedColors } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A swatch that keeps its color under forced colors. */
export default {
	title: "Keeping an element's colors",
	description:
		'Pair it with `forcedColorAdjust("none")` on content whose color is the point, like a color picker\'s swatches:',
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					bg("color.brand.500"),
					is(12),
					bs(12),
					rounded("md"),
					forcedColors(forcedColorAdjust("none")),
				]}
			/>
			<div
				mix={[
					bg("color.success.500"),
					is(12),
					bs(12),
					rounded("md"),
					forcedColors(forcedColorAdjust("none")),
				]}
			/>
			<div
				mix={[
					bg("color.danger.500"),
					is(12),
					bs(12),
					rounded("md"),
					forcedColors(forcedColorAdjust("none")),
				]}
			/>
		</div>
	),
} satisfies UtilityExampleModule;
