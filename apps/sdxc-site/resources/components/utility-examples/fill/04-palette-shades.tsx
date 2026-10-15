/**
 * A `fill` example reading palette shades, the colors a chart's series take when each
 * needs its own step of one hue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Bars filled with four shades of the brand palette. */
export default {
	title: "Palette shades",
	description:
		"Use a palette shade, like `color.brand.300`, for fills no tone names, such as the series of a chart:",
	render: () => (
		<svg width={160} height={80} viewBox="0 0 160 80" aria-hidden="true">
			<rect x={0} y={50} width={32} height={30} mix={[fill("color.brand.200")]} />
			<rect x={42} y={30} width={32} height={50} mix={[fill("color.brand.400")]} />
			<rect x={84} y={15} width={32} height={65} mix={[fill("color.brand.600")]} />
			<rect x={126} y={0} width={32} height={80} mix={[fill("color.brand.800")]} />
		</svg>
	),
} satisfies UtilityExampleModule;
