/**
 * A `linearGradient` example at three angles, where a bare number is read as degrees,
 * beside a corner keyword.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, linearGradient } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same gradient at several angles. */
export default {
	title: "Angles",
	description:
		"Pass a number of degrees, like `45`, or a side or corner keyword, like `to bottom right`, to set the direction:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					bg({
						image: linearGradient(0, "var(--ui-color-brand-500)", "var(--ui-color-success-400)"),
					}),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				0
			</div>
			<div
				mix={[
					bg({
						image: linearGradient(45, "var(--ui-color-brand-500)", "var(--ui-color-success-400)"),
					}),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				45
			</div>
			<div
				mix={[
					bg({
						image: linearGradient(90, "var(--ui-color-brand-500)", "var(--ui-color-success-400)"),
					}),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				90
			</div>
			<div
				mix={[
					bg({
						image: linearGradient(
							"to bottom right",
							"var(--ui-color-brand-500)",
							"var(--ui-color-success-400)",
						),
					}),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				to bottom right
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
