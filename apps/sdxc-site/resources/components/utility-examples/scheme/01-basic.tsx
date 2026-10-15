/**
 * The opening `scheme` example: a badge given its own colors for each color scheme from
 * one utility, so a reader sees both branches written side by side.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { scheme } from "sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A value per color scheme from one utility. */
export default {
	title: "Basic example",
	description:
		'Use `scheme("light", ...)` and `scheme("dark", ...)` to style each color scheme, following your system\'s appearance setting. Switch your system between light and dark mode to see the badge change:',
	render: () => (
		<span
			mix={[
				scheme("light", [bg("color.success.100"), fg("color.success.800")]),
				scheme("dark", [bg("color.success.800"), fg("color.success.100")]),
				demo.swatch(),
			]}
		>
			Deployed
		</span>
	),
} satisfies UtilityExampleModule;
