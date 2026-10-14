/**
 * The opening `hasSibling` example: a status dot that turns green when the switch after it
 * is on, so the reader toggles the checkbox and sees an earlier sibling react.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { accent, bg } from "@sdxc/u/color";
import { transition } from "@sdxc/u/effects";
import { hstack } from "@sdxc/u/layout";
import { circle, is } from "@sdxc/u/size";
import { hasSibling } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** The dot fills green while the checkbox following it is checked. */
export default {
	title: "Basic example",
	description:
		"Pass a selector to `hasSibling()` to style an element by a sibling that comes after it. Tick the checkbox:",
	render: () => (
		<label mix={[hstack({ gap: 2, align: "center" }), text("sm")]}>
			<span
				mix={[
					circle(),
					is(3),
					bg("neutral.solid"),
					hasSibling("input:checked", bg("success.solid")),
					transition("background-color"),
				]}
			/>
			<input type="checkbox" mix={[accent("success")]} />
			Available for work
		</label>
	),
} satisfies UtilityExampleModule;
