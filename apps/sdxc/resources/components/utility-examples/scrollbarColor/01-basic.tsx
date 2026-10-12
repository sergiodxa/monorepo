/**
 * The opening `scrollbarColor` example: a scroll container whose thumb takes a tone's
 * border color over a transparent track.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scroll, scrollbarColor } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A themed thumb over the container's own background. */
export default {
	title: "Basic example",
	description:
		'Use `scrollbarColor("neutral")` to color the scrollbar thumb with a tone, leaving the track transparent. Scroll the box, or set your system to always show scrollbars, to see it:',
	render: () => (
		<div
			mix={[scroll("y"), scrollbarColor("neutral"), bs(24), is(72), maxIs("100%"), demo.panel()]}
		>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
