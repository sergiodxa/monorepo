/**
 * A `linearGradient` example with positioned stops, three colors and a hard edge, so a
 * reader sees how a stop's position shapes the band it draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, linearGradient } from "@sdxc/u/color";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Three positioned stops, with a hard stop between the last two. */
export default {
	title: "Color stops",
	description:
		"Pass a stop as an object with a `position`, like `20%`, to place it; two stops at one position draw a hard edge:",
	render: () => (
		<div
			mix={[
				bg({
					image: linearGradient(
						"to right",
						{ color: "var(--ui-color-brand-500)", position: "20%" },
						{ color: "var(--ui-color-warning-400)", position: "60%" },
						{ color: "var(--ui-color-danger-500)", position: "60%" },
					),
				}),
				fg("brand.onSolid"),
				is(96),
				demo.swatch(),
			]}
		>
			20% · 60% · 60%
		</div>
	),
} satisfies UtilityExampleModule;
