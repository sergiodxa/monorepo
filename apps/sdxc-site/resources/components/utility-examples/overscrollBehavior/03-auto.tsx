/**
 * An `overscrollBehavior` example with `auto`, the platform default, so a reader sees
 * the scroll carry on to the page once the box reaches its end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overscrollBehavior, scroll } from "sdxc/u/overflow";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scroll that chains to the page at the box's end. */
export default {
	title: "Chaining to the page",
	description:
		'Use `overscrollBehavior("auto")` to restore the default, where a scroll past the end carries on to the page. Scroll to the bottom of the box and keep scrolling:',
	render: () => (
		<div
			mix={[scroll("y"), overscrollBehavior("auto"), bs(24), is(72), maxIs("100%"), demo.panel()]}
		>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
