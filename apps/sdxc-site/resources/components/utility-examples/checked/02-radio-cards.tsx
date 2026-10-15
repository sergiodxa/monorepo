/**
 * A `checked` example on native radios, each tinted with the system `accent()` and
 * outlined when picked, so the reader switches between them and sees one state at a time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { accent, outline } from "sdxc/u/color";
import { cursor } from "sdxc/u/general";
import { hstack } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";
import { checked } from "sdxc/u/state";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A ring around whichever radio of the group is selected. */
export default {
	title: "Radio buttons",
	description:
		"Radios match `checked()` too, and only one of a group is checked at a time. Pick a plan:",
	render: () => (
		<fieldset mix={[demo.row()]}>
			<label mix={[hstack({ gap: 2, align: "center" }), text("sm"), cursor("pointer")]}>
				<input
					type="radio"
					name="plan"
					checked
					mix={[accent(), is(4), bs(4), checked(outline({ color: "brand", offset: 2 }))]}
				/>
				Monthly
			</label>
			<label mix={[hstack({ gap: 2, align: "center" }), text("sm"), cursor("pointer")]}>
				<input
					type="radio"
					name="plan"
					mix={[accent(), is(4), bs(4), checked(outline({ color: "brand", offset: 2 }))]}
				/>
				Yearly
			</label>
		</fieldset>
	),
} satisfies UtilityExampleModule;
