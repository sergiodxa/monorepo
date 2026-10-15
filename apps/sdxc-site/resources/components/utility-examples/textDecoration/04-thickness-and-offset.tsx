/**
 * A `textDecoration` example setting the line's thickness and its distance from the text,
 * the two parts of a decoration the CSS shorthand cannot set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text, textDecoration } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Underlines at three thicknesses and three offsets. */
export default {
	title: "Thickness and offset",
	description:
		'Set `thickness` and `offset` in pixels, or pass `"from-font"` and `"auto"`, to change how heavy the line is and how far below the text it sits:',
	render: () => (
		<div mix={[demo.stack()]}>
			<p mix={[textDecoration({ line: "underline", thickness: 1, offset: 2 }), text("xl")]}>
				thickness: 1, offset: 2
			</p>
			<p mix={[textDecoration({ line: "underline", thickness: 2, offset: 4 }), text("xl")]}>
				thickness: 2, offset: 4
			</p>
			<p
				mix={[
					textDecoration({ line: "underline", thickness: 4, offset: 8, color: "brand" }),
					text("xl"),
				]}
			>
				thickness: 4, offset: 8
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
