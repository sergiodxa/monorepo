/**
 * A `has` example coloring a whole field group, label included, once the input inside it
 * is invalid, so the reader sees an error reach parts of the form the input cannot style.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "sdxc/u/color";
import { vstack } from "sdxc/u/layout";
import { has } from "sdxc/u/state";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The label turns the danger tone while the field it wraps is invalid. */
export default {
	title: "Styling by a child's state",
	description:
		"Any selector works, like `input:user-invalid` to color a label from its field. Type a word that is not a URL, then click outside:",
	render: () => (
		<label
			mix={[
				vstack({ gap: 1 }),
				text("sm"),
				weight("medium"),
				fg(),
				has("input:user-invalid", fg("danger")),
			]}
		>
			Website
			<input type="url" placeholder="https://" mix={[border("neutral.border"), demo.input()]} />
		</label>
	),
} satisfies UtilityExampleModule;
