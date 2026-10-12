/**
 * An `fg` example reading palette shades and a CSS color function, for text whose color
 * no semantic tone names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Text in palette shades and in an `oklch()` color. */
export default {
	title: "Palette shades and arbitrary colors",
	description:
		"Use a palette shade like `color.brand.400`, or any CSS color function, when no tone names the color:",
	render: () => (
		<div mix={[demo.stack()]}>
			<p mix={[fg("color.brand.400"), demo.prose()]}>fg("color.brand.400")</p>
			<p mix={[fg("color.success.600"), demo.prose()]}>fg("color.success.600")</p>
			<p mix={[fg("oklch(0.65 0.2 30)"), demo.prose()]}>fg("oklch(0.65 0.2 30)")</p>
		</div>
	),
} satisfies UtilityExampleModule;
