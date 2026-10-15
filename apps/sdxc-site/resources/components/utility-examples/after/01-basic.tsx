/**
 * The opening `after` example: required labels marked with an asterisk generated in CSS,
 * so the reader sees content appended after an element's text with no extra markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "@sdxc/u/color";
import { pseudoContent } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { after } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A danger-colored asterisk painted in each required label's `::after`. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `after()` to style an element's `::after` pseudo-element, like an asterisk after a required field's label:",
	render: () => (
		<label mix={[vstack({ gap: 1 })]}>
			<span mix={[text("sm"), weight("medium"), after([pseudoContent('" *"'), fg("danger")])]}>
				Email
			</span>
			<input type="email" required mix={[border("neutral.border"), demo.input()]} />
		</label>
	),
} satisfies UtilityExampleModule;
