/**
 * An `accent` example reading a palette shade and a CSS color function, for a control
 * whose color no tone names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { accent } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A range in a palette shade and a range in an `oklch()` color. */
export default {
	title: "Palette shades and arbitrary colors",
	description:
		"Pass a palette shade like `color.brand.300`, or any CSS color function, for a color no tone names:",
	render: () => (
		<div mix={[demo.stack()]}>
			<input type="range" mix={[accent("color.brand.300")]} aria-label="Light brand" />
			<input type="range" mix={[accent("oklch(0.7 0.18 150)")]} aria-label="Green" />
		</div>
	),
} satisfies UtilityExampleModule;
