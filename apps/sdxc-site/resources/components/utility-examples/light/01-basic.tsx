/**
 * The opening `light` example: a banner written dark first, which lightens only when
 * the reader's system is in light mode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { light } from "@sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Palette colors swapped in light mode. */
export default {
	title: "Basic example",
	description:
		"Use `light(...)` to apply utilities only in light mode, for a design written dark first. Switch your system between light and dark mode to see the banner change:",
	render: () => (
		<div
			mix={[
				bg("color.brand.950"),
				fg("color.brand.50"),
				light([bg("color.brand.50"), fg("color.brand.950")]),
				demo.swatch(),
			]}
		>
			New: export your data as CSV.
		</div>
	),
} satisfies UtilityExampleModule;
