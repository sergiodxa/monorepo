/**
 * The opening `forcedColorAdjust` example: a legend whose swatches keep their colors in
 * forced-colors mode, where the browser would otherwise repaint them in the system
 * palette.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { forcedColorAdjust } from "@sdxc/u/a11y";
import { bg, fg } from "@sdxc/u/color";
import { forcedColors } from "@sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Legend swatches that keep their colors under forced colors. */
export default {
	title: "Basic example",
	description:
		"Use `forcedColorAdjust()`, scoped with `forcedColors()`, to keep colors that carry meaning. Turn on a forced-colors mode to compare:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					bg("success.solid"),
					fg("success.onSolid"),
					forcedColors(forcedColorAdjust()),
					demo.swatch(),
				]}
			>
				Up
			</div>
			<div
				mix={[
					bg("warning.solid"),
					fg("warning.onSolid"),
					forcedColors(forcedColorAdjust()),
					demo.swatch(),
				]}
			>
				Flat
			</div>
			<div
				mix={[
					bg("danger.solid"),
					fg("danger.onSolid"),
					forcedColors(forcedColorAdjust()),
					demo.swatch(),
				]}
			>
				Down
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
