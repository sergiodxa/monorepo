/**
 * A `strokeLinecap` example on a dashed line, where a round cap turns every dash into a
 * dot-ended pill, the way a loading track or a divider is often drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stroke, strokeLinecap, strokeWidth } from "sdxc/u/color";
import { raw } from "sdxc/u/general";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A dashed line with butt caps and one with round caps. */
export default {
	title: "Caps on dashes",
	description:
		"A cap applies to every dash of a dashed line, so `round` gives each dash rounded ends:",
	render: () => (
		<svg width={240} height={64} viewBox="0 0 240 64" aria-hidden="true">
			<line
				x1={16}
				y1={16}
				x2={224}
				y2={16}
				mix={[
					stroke("brand"),
					strokeWidth(8),
					raw({ strokeDasharray: "16 12" }),
					strokeLinecap("butt"),
				]}
			/>
			<line
				x1={16}
				y1={48}
				x2={224}
				y2={48}
				mix={[
					stroke("brand"),
					strokeWidth(8),
					raw({ strokeDasharray: "16 12" }),
					strokeLinecap("round"),
				]}
			/>
		</svg>
	),
} satisfies UtilityExampleModule;
