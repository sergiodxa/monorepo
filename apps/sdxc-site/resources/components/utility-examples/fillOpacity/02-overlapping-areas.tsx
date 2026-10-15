/**
 * A `fillOpacity` example of two overlapping chart areas, where a partial fill keeps the
 * series behind visible through the one in front.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, fillOpacity, stroke, strokeWidth } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Two area series overlapping, each with a half-opaque fill. */
export default {
	title: "Overlapping areas",
	description:
		"Lower the fill opacity of overlapping shapes, like the areas of a chart, so each stays visible through the other:",
	render: () => (
		<svg width={240} height={96} viewBox="0 0 240 96" aria-hidden="true">
			<path
				d="M0 96 L0 60 L60 30 L120 50 L180 10 L240 40 L240 96 Z"
				mix={[fill("brand"), fillOpacity(40), stroke("brand"), strokeWidth(2)]}
			/>
			<path
				d="M0 96 L0 40 L60 70 L120 20 L180 60 L240 30 L240 96 Z"
				mix={[fill("success"), fillOpacity(40), stroke("success"), strokeWidth(2)]}
			/>
		</svg>
	),
} satisfies UtilityExampleModule;
