/**
 * A `radialGradient` example moving the gradient's center with an `at` clause, so the
 * glow sits in a corner of the element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, radialGradient } from "@sdxc/u/color";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Gradients centred on a corner and on an edge. */
export default {
	title: "Position",
	description:
		"Add an `at` clause to the shape, like `circle at top left`, to move where the gradient starts:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					bg({
						image: radialGradient(
							"circle at top left",
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
				circle at top left
			</div>
			<div
				mix={[
					bg({
						image: radialGradient(
							"ellipse at bottom",
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
				ellipse at bottom
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
