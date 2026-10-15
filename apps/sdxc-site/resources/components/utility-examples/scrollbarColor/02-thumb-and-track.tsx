/**
 * A `scrollbarColor` example with a thumb and a track, so a reader sees the second
 * argument paint the track.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scroll, scrollbarColor } from "sdxc/u/overflow";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A thumb and a track colored from two tones. */
export default {
	title: "Thumb and track",
	description:
		'Pass a second color to paint the track too, like `scrollbarColor("brand.strong", "neutral")`:',
	render: () => (
		<div
			mix={[
				scroll("y"),
				scrollbarColor("brand.strong", "neutral"),
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
