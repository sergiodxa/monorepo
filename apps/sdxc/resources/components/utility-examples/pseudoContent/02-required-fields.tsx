/**
 * A `pseudoContent` example marking required fields: an asterisk after the label of each
 * field the form cannot be sent without, colored apart from the label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pseudoContent } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { maxIs, p } from "@sdxc/u/size";
import { after } from "@sdxc/u/state";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A label with a red asterisk after it, drawn by a pseudo-element. */
export default {
	title: "Marking required fields",
	description:
		'Combine `pseudoContent()` with other utilities on the same pseudo-element, like `after([pseudoContent(\'" *"\'), fg("danger")])`:',
	render: () => (
		<label mix={[vstack({ gap: 1 }), maxIs(72)]}>
			<span mix={[weight("medium"), after([pseudoContent('" *"'), fg("danger")])]}>
				Email address
			</span>
			<input
				type="email"
				required
				mix={[
					p(2, 3),
					rounded("md"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
				]}
			/>
		</label>
	),
} satisfies UtilityExampleModule;
