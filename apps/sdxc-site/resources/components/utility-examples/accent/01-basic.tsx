/**
 * The opening `accent` example: a checkbox, a radio and a range that paint themselves in
 * the brand color from one call, with no custom control drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { accent } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Native controls painted in the brand color. */
export default {
	title: "Basic example",
	description:
		"Use `accent()` to color the parts a browser paints in a native checkbox, radio, range or progress bar:",
	render: () => (
		<div mix={[demo.row()]}>
			<input type="checkbox" checked mix={[accent()]} aria-label="Checkbox" />
			<input type="radio" checked mix={[accent()]} aria-label="Radio" />
			<input type="range" mix={[accent()]} aria-label="Range" />
			<progress value={60} max={100} mix={[accent()]} />
		</div>
	),
} satisfies UtilityExampleModule;
