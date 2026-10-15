/**
 * A `strokeLinejoin` example pairing a round join with a round cap, the combination line
 * icon sets use for their soft corners.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, stroke, strokeLinecap, strokeLinejoin, strokeWidth } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A check mark with sharp corners beside one with rounded corners. */
export default {
	title: "Rounded icons",
	description: "Pair `round` joins with `round` caps for the soft corners of a line icon:",
	render: () => (
		<div mix={[demo.row()]}>
			<svg
				mix={[stroke("brand"), fill("none"), strokeWidth(3), strokeLinejoin("miter")]}
				viewBox="0 0 24 24"
				width={64}
				height={64}
				aria-hidden="true"
			>
				<path d="M4 12l5 5L20 6" />
			</svg>
			<svg
				mix={[
					stroke("brand"),
					fill("none"),
					strokeWidth(3),
					strokeLinejoin("round"),
					strokeLinecap("round"),
				]}
				viewBox="0 0 24 24"
				width={64}
				height={64}
				aria-hidden="true"
			>
				<path d="M4 12l5 5L20 6" />
			</svg>
		</div>
	),
} satisfies UtilityExampleModule;
