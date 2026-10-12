/**
 * The opening `checked` example: a checkbox drawn from scratch with `appearance()`, which
 * fills with the brand color once ticked, so the reader clicks it to see the state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { appearance, hstack } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { checked } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A custom box whose background and border switch to the brand tone when checked. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `checked()` to style a checkbox or radio once it is selected. Click the checkbox:",
	render: () => (
		<label mix={[hstack({ gap: 2, align: "center" }), text("sm"), cursor("pointer")]}>
			<input
				type="checkbox"
				mix={[
					appearance(),
					is(5),
					bs(5),
					rounded("sm"),
					bg(),
					border({ color: "neutral.strong", width: 2 }),
					checked([bg("brand.solid"), border("brand.solid")]),
					cursor("pointer"),
				]}
			/>
			Email me about new releases
		</label>
	),
} satisfies UtilityExampleModule;
