/**
 * A `stroke` example with `currentColor`, which lets a line icon in a link take the
 * link's text color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg, fill, stroke, strokeWidth } from "@sdxc/u/color";
import { gap, inlineFlex } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A line icon stroked in its link's text color. */
export default {
	title: "Following the text color",
	description: "Pass `currentColor` so a line icon takes the text color of the element around it:",
	render: () => (
		<a href="#stroke" mix={[fg("brand"), inlineFlex(), gap(2), demo.prose()]}>
			Read the guide
			<svg
				mix={[stroke("currentColor"), fill("none"), strokeWidth(2)]}
				viewBox="0 0 24 24"
				width={20}
				height={20}
				aria-hidden="true"
			>
				<path d="M5 12h14M13 6l6 6-6 6" />
			</svg>
		</a>
	),
} satisfies UtilityExampleModule;
