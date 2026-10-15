/**
 * The opening `strokeLinejoin` example: one zigzag drawn with each join, so a reader
 * sees the corners turn sharp, rounded or cut.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, stroke, strokeLinejoin, strokeWidth } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A zigzag with miter, round and bevel joins. */
export default {
	title: "Basic example",
	description:
		"Use `strokeLinejoin` to set how the corners between two segments of a stroke are drawn:",
	render: () => (
		<svg width={300} height={80} viewBox="0 0 300 80" aria-hidden="true">
			<polyline
				points="10,70 40,15 70,70"
				mix={[stroke("brand"), fill("none"), strokeWidth(12), strokeLinejoin("miter")]}
			/>
			<polyline
				points="115,70 145,15 175,70"
				mix={[stroke("brand"), fill("none"), strokeWidth(12), strokeLinejoin("round")]}
			/>
			<polyline
				points="220,70 250,15 280,70"
				mix={[stroke("brand"), fill("none"), strokeWidth(12), strokeLinejoin("bevel")]}
			/>
		</svg>
	),
} satisfies UtilityExampleModule;
