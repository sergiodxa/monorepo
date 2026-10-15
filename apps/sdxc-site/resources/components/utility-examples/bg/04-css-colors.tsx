/**
 * A `bg` example with CSS color functions passed straight through, so a reader sees that
 * any value holding a parenthesis reaches the declaration unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, colorMix, fg } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An `oklch()` color and a `color-mix()` passed through unchanged. */
export default {
	title: "Arbitrary colors",
	description:
		"Pass a CSS color function, like `oklch()` or one built with `colorMix`, and it is used as written:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[bg("oklch(0.72 0.16 160)"), fg("color.neutral.950"), demo.swatch()]}>
				bg("oklch(0.72 0.16 160)")
			</div>
			<div
				mix={[
					bg(colorMix("oklab", "var(--ui-brand-bg-solid) 40%", "transparent")),
					fg(),
					demo.swatch(),
				]}
			>
				bg(colorMix(...))
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
