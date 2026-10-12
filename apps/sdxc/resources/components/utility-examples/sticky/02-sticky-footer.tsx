/**
 * A `sticky` example at the other end: an action bar held to the bottom of a scrolling
 * panel, so its buttons stay in reach while the content scrolls under it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border } from "@sdxc/u/color";
import { hstack, insBe, sticky } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A block-end offset sticks an element to the bottom of the scroller. */
export default {
	title: "Sticking to the bottom",
	description:
		"Pair `sticky()` with `insBe(0)` to hold an element to the bottom of its scroller instead. Scroll the terms to see it:",
	render: () => (
		<div mix={[overflow("auto"), is(72), bs(56), demo.frame()]}>
			{Array.from({ length: 8 }, (_, index) => (
				<p mix={[p(2, 4), demo.prose()]}>Section {index + 1} of the terms of service.</p>
			))}
			<div
				mix={[
					sticky(),
					insBe(0),
					hstack({ gap: 2, justify: "end" }),
					p(3),
					bg(),
					border({ color: "neutral.border", width: 1, style: "solid" }),
				]}
			>
				<button type="button" mix={[demo.button()]}>
					Decline
				</button>
				<button type="button" mix={[demo.button()]}>
					Accept
				</button>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
