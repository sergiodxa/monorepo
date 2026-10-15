/**
 * The opening `forcedColors` example: status badges told apart only by color, given a
 * border in forced-colors mode where the system palette erases that color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "sdxc/u/color";
import { forcedColors } from "sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A border restored where forced colors erase a color cue. */
export default {
	title: "Basic example",
	description:
		"Use `forcedColors(...)` to apply utilities when the system forces its own palette, as a Windows contrast theme does, to restore cues that color alone carried. Emulate `forced-colors: active` in your browser's dev tools to see the border appear:",
	render: () => (
		<span
			mix={[
				bg("success.solid"),
				fg("success.onSolid"),
				forcedColors(border({ width: 2 })),
				demo.swatch(),
			]}
		>
			Online
		</span>
	),
} satisfies UtilityExampleModule;
