/**
 * A `textShadow` example on light text over a photograph, the case the utility exists
 * for, beside the same line without it so the gain in legibility shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { textShadow } from "@sdxc/u/effects";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Light text over a photograph, with and without a shadow. */
export default {
	title: "Keeping text legible over an image",
	description:
		"Shadow light text with `textShadow()` to keep it readable where it crosses a busy image:",
	render: () => (
		<div mix={[demo.scene()]}>
			<p mix={[fg("color.neutral.50"), text("xl"), weight("bold")]}>Without a shadow</p>
			<p
				mix={[
					textShadow({ y: "1px", blur: "3px" }),
					fg("color.neutral.50"),
					text("xl"),
					weight("bold"),
				]}
			>
				With textShadow()
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
