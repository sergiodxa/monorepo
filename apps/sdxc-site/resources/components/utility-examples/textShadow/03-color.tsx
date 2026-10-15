/**
 * A `textShadow` example with a theme color, for a soft brand glow behind a heading, so
 * the reader sees the `color` option take any theme tone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { textShadow } from "sdxc/u/effects";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A brand-colored glow behind a heading. */
export default {
	title: "Changing the color",
	description:
		'Pass a theme `color` to tint the shadow, like `color: "brand.solid"` for a soft glow:',
	render: () => (
		<p mix={[textShadow({ y: 0, blur: 3, color: "brand.solid" }), text("3xl"), weight("bold")]}>
			Launch day
		</p>
	),
} satisfies UtilityExampleModule;
