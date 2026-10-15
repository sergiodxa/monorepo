/**
 * A `fill` example with a light fill under a stroke and an empty one, the two ways an
 * outlined icon is drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, stroke, strokeWidth } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A heart with a light fill and a heart with no fill. */
export default {
	title: "Fills under a stroke, and no fill",
	description:
		"Fill a shape under its outline, here with the palette shade `color.brand.200`, or pass `none` to leave only the outline:",
	render: () => (
		<div mix={[demo.row()]}>
			<svg
				mix={[fill("color.brand.200"), stroke("brand"), strokeWidth(1.5)]}
				viewBox="0 0 24 24"
				width={48}
				height={48}
				aria-hidden="true"
			>
				<path d="M12 20.5S3 15 3 8.9A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.3C21 15 12 20.5 12 20.5z" />
			</svg>
			<svg
				mix={[fill("none"), stroke("brand"), strokeWidth(1.5)]}
				viewBox="0 0 24 24"
				width={48}
				height={48}
				aria-hidden="true"
			>
				<path d="M12 20.5S3 15 3 8.9A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.3C21 15 12 20.5 12 20.5z" />
			</svg>
		</div>
	),
} satisfies UtilityExampleModule;
