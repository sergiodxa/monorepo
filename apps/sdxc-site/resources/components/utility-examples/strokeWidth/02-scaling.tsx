/**
 * A `strokeWidth` example of the same icon at two sizes, showing a unitless width scale
 * with the drawing while a pixel width stays put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, stroke, strokeWidth } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An icon drawn small and large, with a unitless and a pixel stroke width. */
export default {
	title: "Units and scaling",
	description:
		"A number scales with the drawing; pass a string with a unit, like `2px`, for a width that stays the same at every size:",
	render: () => (
		<div mix={[demo.row()]}>
			<svg
				mix={[stroke("brand"), fill("none"), strokeWidth(2)]}
				viewBox="0 0 24 24"
				width={24}
				height={24}
				aria-hidden="true"
			>
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
			<svg
				mix={[stroke("brand"), fill("none"), strokeWidth(2)]}
				viewBox="0 0 24 24"
				width={72}
				height={72}
				aria-hidden="true"
			>
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
			<svg
				mix={[stroke("danger"), fill("none"), strokeWidth("0.75px")]}
				viewBox="0 0 24 24"
				width={72}
				height={72}
				aria-hidden="true"
			>
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
		</div>
	),
} satisfies UtilityExampleModule;
