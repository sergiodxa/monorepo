/**
 * A `forcedColorAdjust` example with `preserve-parent-color`, where an icon opts out of
 * forced colors but still takes the system text color its parent is given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { forcedColorAdjust } from "@sdxc/u/a11y";
import { fg, fill } from "@sdxc/u/color";
import { gap, inlineFlex } from "@sdxc/u/layout";
import { forcedColors } from "@sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An icon that keeps its parent's forced text color. */
export default {
	title: "Keeping the parent's color",
	description:
		"Pass `preserve-parent-color` to opt out of forced colors while still inheriting the color the system gives the parent:",
	render: () => (
		<p mix={[fg("brand"), inlineFlex(), gap(2), demo.prose()]}>
			<svg
				mix={[fill("currentColor"), forcedColors(forcedColorAdjust("preserve-parent-color"))]}
				viewBox="0 0 24 24"
				width={20}
				height={20}
				aria-hidden="true"
			>
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
			Featured
		</p>
	),
} satisfies UtilityExampleModule;
