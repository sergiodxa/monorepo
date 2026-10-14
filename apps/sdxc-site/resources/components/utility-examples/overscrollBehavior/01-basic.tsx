/**
 * The opening `overscrollBehavior` example: a scroll box that keeps a scroll past its
 * end to itself, so the page behind it holds still.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overscrollBehavior, scroll } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scroll past the end that stays inside the box. */
export default {
	title: "Basic example",
	description:
		"Use `overscrollBehavior()`, which applies `contain`, to stop a scroll that reaches the end of an element from carrying on to the page. Scroll to the bottom of the box and keep scrolling:",
	render: () => (
		<div mix={[scroll("y"), overscrollBehavior(), bs(24), is(72), maxIs("100%"), demo.panel()]}>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
