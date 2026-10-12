/**
 * A `textDecoration` example tinting the line apart from the text, the way a link can
 * keep body-colored words over a brand-colored underline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "@sdxc/u/size";
import { textDecoration } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Links in a paragraph underlined in the brand and danger tones. */
export default {
	title: "Decoration color",
	description:
		'Pass an options object with a `color` from the theme, like `textDecoration({ line: "underline", color: "brand" })`, to tint the line apart from the text:',
	render: () => (
		<p mix={[maxIs(96), demo.prose()]}>
			Our bakery opens at seven, and the{" "}
			<a href="/weekly-menu" mix={[textDecoration({ line: "underline", color: "brand" })]}>
				weekly menu
			</a>{" "}
			changes every Monday. Anything with nuts is marked, and the{" "}
			<a href="/allergen-list" mix={[textDecoration({ line: "underline", color: "danger" })]}>
				allergen list
			</a>{" "}
			covers the rest.
		</p>
	),
} satisfies UtilityExampleModule;
