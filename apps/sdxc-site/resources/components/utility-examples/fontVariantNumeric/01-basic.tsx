/**
 * The opening `fontVariantNumeric` example: a column of figures with tabular and with
 * proportional digits, the feature the call requests when given no value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate } from "sdxc/u/layout";
import { fontVariantNumeric, textAlign } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Lap times with tabular digits beside the same times with proportional ones. */
export default {
	title: "Basic example",
	description:
		'Use `fontVariantNumeric(value)` to pick how a font draws its digits; with no value it uses `"tabular-nums"`, which lines figures up in columns:',
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: "auto auto" }), gap(12)]}>
			<div mix={[textAlign("end")]}>
				<p mix={[demo.caption()]}>fontVariantNumeric()</p>
				<p mix={[fontVariantNumeric()]}>1:11.111</p>
				<p mix={[fontVariantNumeric()]}>1:08.808</p>
				<p mix={[fontVariantNumeric()]}>1:14.441</p>
			</div>
			<div mix={[textAlign("end")]}>
				<p mix={[demo.caption()]}>fontVariantNumeric("proportional-nums")</p>
				<p mix={[fontVariantNumeric("proportional-nums")]}>1:11.111</p>
				<p mix={[fontVariantNumeric("proportional-nums")]}>1:08.808</p>
				<p mix={[fontVariantNumeric("proportional-nums")]}>1:14.441</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
