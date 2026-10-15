/**
 * The opening `dark` example: a card painted from fixed palette shades, swapped for
 * darker ones when the reader's system is in dark mode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { dark } from "sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Palette colors swapped in dark mode. */
export default {
	title: "Basic example",
	description:
		"Use `dark(...)` to apply utilities only in dark mode, which follows your system's appearance setting. Switch your system to dark mode to see the card change:",
	render: () => (
		<div
			mix={[
				bg("color.warning.100"),
				fg("color.warning.900"),
				dark([bg("color.warning.900"), fg("color.warning.100")]),
				demo.swatch(),
			]}
		>
			Your trial ends in 3 days.
		</div>
	),
} satisfies UtilityExampleModule;
