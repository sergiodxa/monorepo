/**
 * A `bg` example with `clip: "content-box"`, where the paint stops at the content edge
 * and the padding around it stays empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "sdxc/u/color";
import { p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The background clipped to the content box, leaving the padding unpainted. */
export default {
	title: "Background clip",
	description:
		"Set `clip` to keep the background off the border or the padding; with `content-box` the padding stays unpainted:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					bg({ color: "brand.solid", clip: "border-box" }),
					border({ color: "brand.strong", width: 4, style: "dashed" }),
					p(4),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				border-box
			</div>
			<div
				mix={[
					bg({ color: "brand.solid", clip: "padding-box" }),
					border({ color: "brand.strong", width: 4, style: "dashed" }),
					p(4),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				padding-box
			</div>
			<div
				mix={[
					bg({ color: "brand.solid", clip: "content-box" }),
					border({ color: "brand.strong", width: 4, style: "dashed" }),
					p(4),
					fg("brand.onSolid"),
					demo.swatch(),
				]}
			>
				content-box
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
