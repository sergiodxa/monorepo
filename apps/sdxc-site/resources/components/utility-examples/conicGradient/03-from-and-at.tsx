/**
 * A `conicGradient` example with a full `from ... at ...` clause, rotating the sweep and
 * moving its center off the middle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, conicGradient, fg } from "sdxc/u/color";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A sweep rotated by 90 degrees and centred on the top left corner. */
export default {
	title: "Rotation and center",
	description:
		"Pass the full clause, like `from 90deg at top left`, to rotate the sweep and move its center:",
	render: () => (
		<div
			mix={[
				bg({
					image: conicGradient(
						"from 90deg at top left",
						"var(--ui-color-brand-600)",
						"var(--ui-color-warning-300)",
					),
				}),
				fg("brand.onSolid"),
				is(64),
				bs(32),
				demo.swatch(),
			]}
		>
			from 90deg at top left
		</div>
	),
} satisfies UtilityExampleModule;
