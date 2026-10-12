/**
 * A `caretColor` example with a tone weight and a palette shade, for a caret that must
 * read against the field's own background.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { caretColor } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A caret at a tone's emphasis weight and one from the palette. */
export default {
	title: "Weights and palette shades",
	description:
		"Name a weight, like `brand.emphasis`, or a palette shade, like `color.warning.500`, when the plain tone reads too faint:",
	render: () => (
		<div mix={[demo.stack()]}>
			<input
				type="text"
				value="brand.emphasis"
				mix={[caretColor("brand.emphasis"), demo.field()]}
				aria-label="Emphasis caret"
			/>
			<input
				type="text"
				value="color.warning.500"
				mix={[caretColor("color.warning.500"), demo.field()]}
				aria-label="Palette caret"
			/>
		</div>
	),
} satisfies UtilityExampleModule;
