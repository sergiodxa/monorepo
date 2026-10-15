/**
 * A `fontVariantNumeric` example that changes glyphs rather than widths: fractions typed
 * with a slash and drawn by the font as one character each.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fontVariantNumeric, text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Recipe quantities with and without diagonal fractions. */
export default {
	title: "Fractions",
	description:
		'Use `fontVariantNumeric("diagonal-fractions")` to draw `3/4` as a fraction, where the font supports it:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>fontVariantNumeric("diagonal-fractions")</p>
				<p mix={[fontVariantNumeric("diagonal-fractions"), text("2xl")]}>
					Add 3/4 cup sugar and 1/2 cup milk
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>default digits</p>
				<p mix={[text("2xl")]}>Add 3/4 cup sugar and 1/2 cup milk</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
