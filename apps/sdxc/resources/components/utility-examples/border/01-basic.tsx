/**
 * The opening `border` example: three boxes with a neutral border at growing widths, so
 * a reader sees one call set the width, the style and the color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A neutral border at three widths. */
export default {
	title: "Basic example",
	description:
		"Use `border` with an object to set the width, color and style of an element's border together; the style defaults to `solid`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[border({ color: "neutral.strong", width: 1 }), demo.swatch()]}>width: 1</div>
			<div mix={[border({ color: "neutral.strong", width: 2 }), demo.swatch()]}>width: 2</div>
			<div mix={[border({ color: "neutral.strong", width: 4 }), demo.swatch()]}>width: 4</div>
		</div>
	),
} satisfies UtilityExampleModule;
