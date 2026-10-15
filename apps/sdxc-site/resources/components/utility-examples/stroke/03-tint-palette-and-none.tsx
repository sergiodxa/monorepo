/**
 * A `stroke` example with a tinted stroke, a palette shade and no stroke at all, for a
 * shape whose outline is quiet, specific or absent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, stroke, strokeWidth } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Circles stroked in a tint, in a palette shade and not at all. */
export default {
	title: "Tints, palette shades and no stroke",
	description:
		"Pass a weight, like `neutral.tint`, a palette shade, like `color.brand.300`, or `none` to drop the stroke:",
	render: () => (
		<svg width={240} height={72} viewBox="0 0 240 72" aria-hidden="true">
			<circle
				cx={36}
				cy={36}
				r={28}
				mix={[fill("brand"), stroke("neutral.tint"), strokeWidth(6)]}
			/>
			<circle
				cx={120}
				cy={36}
				r={28}
				mix={[fill("brand"), stroke("color.brand.300"), strokeWidth(6)]}
			/>
			<circle cx={204} cy={36} r={28} mix={[fill("brand"), stroke("none")]} />
		</svg>
	),
} satisfies UtilityExampleModule;
