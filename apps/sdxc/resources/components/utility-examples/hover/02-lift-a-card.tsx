/**
 * A `hover` example on a card rather than a button, raising its shadow under the pointer,
 * so the reader sees a state wrapper take any utility, not only colors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { shadow, transition } from "@sdxc/u/effects";
import { hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A shadow that deepens while the pointer is over the card, eased by a transition. */
export default {
	title: "Raising a card",
	description:
		"Any utility works inside `hover()`, like a deeper `shadow()`. Hover the card to lift it off the page:",
	render: () => (
		<article mix={[shadow("sm"), hover(shadow("xl")), transition("box-shadow"), demo.panel()]}>
			<h3 mix={[text("base"), weight("semibold")]}>Weekly report</h3>
			<p mix={[demo.caption()]}>hover(shadow("xl"))</p>
		</article>
	),
} satisfies UtilityExampleModule;
