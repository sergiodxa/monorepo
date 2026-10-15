/**
 * A `font` example passing `"inherit"`: a button inside serif copy, which browsers set in
 * their own face until the call makes it take the family of the text around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { p } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A form control picking up the font family of its surrounding text. */
export default {
	title: "Inheriting the family",
	description:
		'Use `font("inherit")` on a control like a button, which browsers set in their own face, to match the text around it:',
	render: () => (
		<p mix={[font("serif"), text("lg")]}>
			Every recipe on this page serves four.{" "}
			<button
				mix={[
					font("inherit"),
					text("lg"),
					p(1, 3),
					rounded("md"),
					bg("brand.tint"),
					fg("brand.emphasis"),
				]}
			>
				Scale for eight
			</button>
		</p>
	),
} satisfies UtilityExampleModule;
