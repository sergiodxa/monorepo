/**
 * A `radialGradient` example with a hard stop and two extent keywords, so a reader sees
 * how far each extent lets the shape reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg, radialGradient } from "sdxc/u/color";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A hard-edged circle sized to the closest side and to the farthest corner. */
export default {
	title: "Extent",
	description:
		"Name an extent, like `closest-side` or `farthest-corner`, to set how far the shape reaches before its last stop:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					bg({
						image: radialGradient(
							"circle closest-side",
							{ color: "var(--ui-color-brand-500)", position: "99%" },
							"var(--ui-color-brand-100)",
						),
					}),
					fg("brand.onSolid"),
					is(48),
					bs(32),
					demo.swatch(),
				]}
			>
				closest-side
			</div>
			<div
				mix={[
					bg({
						image: radialGradient(
							"circle farthest-corner",
							{ color: "var(--ui-color-brand-500)", position: "60%" },
							"var(--ui-color-brand-100)",
						),
					}),
					fg("brand.onSolid"),
					is(48),
					bs(32),
					demo.swatch(),
				]}
			>
				farthest-corner
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
