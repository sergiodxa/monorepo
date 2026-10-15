/**
 * A `scrollbarColor` example from palette shades rather than tones, for a scrollbar
 * that keeps the same colors in light and dark themes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scroll, scrollbarColor } from "sdxc/u/overflow";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A thumb and a track from fixed palette shades. */
export default {
	title: "Using palette shades",
	description:
		'Pass palette paths, like `scrollbarColor("color.brand.500", "color.brand.100")`, for exact shades:',
	render: () => (
		<div
			mix={[
				scroll("y"),
				scrollbarColor("color.brand.500", "color.brand.100"),
				bs(24),
				is(72),
				maxIs("100%"),
				demo.panel(),
			]}
		>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
