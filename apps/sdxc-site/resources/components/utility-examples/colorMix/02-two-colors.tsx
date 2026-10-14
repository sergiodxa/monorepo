/**
 * A `colorMix` example blending two tones, with the interpolation space swapped, so a
 * reader sees the space change the midpoint of the same two colors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, colorMix, fg } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Brand and danger mixed half and half in three color spaces. */
export default {
	title: "Mixing two colors",
	description:
		"Mix two colors by passing both as stops; the color space, like `oklch` or `srgb`, decides the hue halfway between them:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					bg(colorMix("srgb", "var(--ui-brand-bg-solid)", "var(--ui-success-bg-solid)")),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				srgb
			</div>
			<div
				mix={[
					bg(colorMix("oklab", "var(--ui-brand-bg-solid)", "var(--ui-success-bg-solid)")),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				oklab
			</div>
			<div
				mix={[
					bg(colorMix("oklch", "var(--ui-brand-bg-solid)", "var(--ui-success-bg-solid)")),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				oklch
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
