/**
 * A `bg` example reading the raw palette, one swatch per shade, for the cases a semantic
 * tone does not name, such as a chart series or an illustration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Raw palette shades, from light to dark. */
export default {
	title: "Palette shades",
	description:
		"Reach past the tones to a palette shade, written `color.<palette>.<shade>` like `color.brand.300`, when no tone names the color you need:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[bg("color.brand.100"), fg("color.brand.900"), demo.swatch()]}>100</div>
			<div mix={[bg("color.brand.300"), fg("color.brand.900"), demo.swatch()]}>300</div>
			<div mix={[bg("color.brand.500"), fg("color.brand.50"), demo.swatch()]}>500</div>
			<div mix={[bg("color.brand.700"), fg("color.brand.50"), demo.swatch()]}>700</div>
			<div mix={[bg("color.brand.900"), fg("color.brand.100"), demo.swatch()]}>900</div>
		</div>
	),
} satisfies UtilityExampleModule;
