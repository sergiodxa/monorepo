/**
 * The opening `colorMix` example: a tone's solid color mixed with transparency at
 * growing weights, the way a hover tint or an overlay is derived from one token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, colorMix, fg } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A brand color mixed toward transparent at three weights. */
export default {
	title: "Basic example",
	description:
		"Use `colorMix` to build a `color-mix()` value from a color space and its stops, and pass it to any color utility:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					bg(colorMix("oklab", { color: "var(--ui-brand-bg-solid)", weight: 20 }, "transparent")),
					fg(),
					demo.swatch(),
				]}
			>
				20%
			</div>
			<div
				mix={[
					bg(colorMix("oklab", { color: "var(--ui-brand-bg-solid)", weight: 50 }, "transparent")),
					fg(),
					demo.swatch(),
				]}
			>
				50%
			</div>
			<div
				mix={[
					bg(colorMix("oklab", { color: "var(--ui-brand-bg-solid)", weight: 80 }, "transparent")),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				80%
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
