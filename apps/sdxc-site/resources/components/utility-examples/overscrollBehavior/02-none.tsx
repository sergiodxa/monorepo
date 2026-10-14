/**
 * An `overscrollBehavior` example with `none`, which also suppresses the platform's
 * bounce and pull-to-refresh at the box's ends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overscrollBehavior, scroll } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scroll boundary with no chaining and no bounce. */
export default {
	title: "Preventing the bounce",
	description:
		'Use `overscrollBehavior("none")` to also suppress the bounce or pull-to-refresh at the edges, as in a full-screen canvas:',
	render: () => (
		<div
			mix={[scroll("y"), overscrollBehavior("none"), bs(24), is(72), maxIs("100%"), demo.panel()]}
		>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
